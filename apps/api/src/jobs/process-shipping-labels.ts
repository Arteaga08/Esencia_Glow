import {
  DisputeStatus,
  LABEL_PROCESSING_MAX_HOURS,
  LABEL_PURCHASE_TIMEOUT_MS,
  LABEL_REQUEST_LEASE_MINUTES,
  OrderStatus,
  ShippingLabelStatus,
} from "@esencia-glow/shared";
import { logger } from "../config/logger.js";
import { Order } from "../models/order.model.js";
import { processOrderLabel } from "../services/order-label.service.js";
import { recordLabelNeedsReview, recordLabelSuccess, type LabelClaimToken } from "../services/order-label-result.js";
import { applySystemOrderTransition } from "../services/order-system-transition.service.js";
import { resolveShippingProvider, type ShippingProvider } from "../services/shipping-provider.js";
import { convergeOrderWithTracking } from "../services/shipment-tracking.service.js";
import { ShipmentTrackingStatus } from "@esencia-glow/shared";
import { runWithDeadline } from "../utils/run-with-deadline.js";

/**
 * Respaldo del disparo inmediato de guías (Milestone 1.9). Tres barridos:
 *
 * 1. Guías `pending`/`failed` cuyo reintento ya venció -> `processOrderLabel`
 *    (el disparo inmediato se pudo perder, o hubo un rechazo con backoff).
 * 2. Guías `processing` (el proveedor ya cobró, aún no termina) -> se
 *    CONSULTA con `getLabel`; jamás se recompra. Si tardan más de
 *    `LABEL_PROCESSING_MAX_HOURS`, pasan a revisión.
 * 3. Guías `requested` con el lease vencido (el proceso murió a media
 *    compra) -> `needs_review`. NO se recompran: no se sabe si el proveedor
 *    cobró.
 *
 * 4. Transiciones de orden que quedaron a medias: una guía `ready` sobre una
 *    orden todavía `paid`, o un rastreo que va más adelante que la orden
 *    (el proceso murió a media transición, o un contracargo la dejó en
 *    pausa y ya se resolvió). Reintenta la misma transición idempotente.
 *
 * Los barridos 1 y 2 necesitan proveedor; sin él (503 "no configurado") se
 * saltan sin consumir intentos. El 3 no llama al proveedor, así que corre
 * siempre. Cada documento va en su propio try/catch.
 */

interface ShippingLabelsSummary {
  dispatched: number;
  refreshed: number;
  reviewed: number;
  /** Transiciones de orden completadas por el barrido 4. */
  reconciled: number;
  failed: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const DEAD_REQUEST_REASON = "El proceso que compraba la guía no terminó; no se sabe si el proveedor cobró.";
const STUCK_PROCESSING_REASON = `El proveedor no terminó de generar la guía en ${LABEL_PROCESSING_MAX_HOURS} horas.`;

/** Los barridos por documento leen solo lo necesario. */
type LabelSweepDoc = { _id: unknown; label?: { requestedAt?: Date; attempts?: number; providerShipmentId?: string } };

function tokenOf(doc: LabelSweepDoc): LabelClaimToken | undefined {
  const requestedAt = doc.label?.requestedAt;
  const attempts = doc.label?.attempts;
  return requestedAt && attempts !== undefined ? { requestedAt, attempts } : undefined;
}

async function dispatchDueLabels(now: Date, batchSize: number, provider: ShippingProvider, summary: ShippingLabelsSummary) {
  const due = await Order.find({
    "label.status": { $in: [ShippingLabelStatus.PENDING, ShippingLabelStatus.FAILED] },
    "label.nextAttemptAt": { $lte: now },
    status: { $in: [OrderStatus.PAID, OrderStatus.PROCESSING] },
    // Con contracargo abierto el claim la rechazaría siempre: excluirla aquí
    // evita que esas órdenes acaparen el lote y dejen sin turno a las demás.
    disputeStatus: { $ne: DisputeStatus.OPEN },
  })
    .sort({ "label.nextAttemptAt": 1 })
    .limit(batchSize)
    .select("_id")
    .lean();

  for (const doc of due) {
    try {
      const { outcome } = await processOrderLabel(String(doc._id), { now, provider });
      if (!outcome.startsWith("skipped")) summary.dispatched += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error({ err: error, orderId: String(doc._id) }, "Falló el barrido de guías pendientes");
    }
  }
}

async function refreshProcessingLabels(now: Date, batchSize: number, provider: ShippingProvider, summary: ShippingLabelsSummary) {
  const processing = await Order.find({ "label.status": ShippingLabelStatus.PROCESSING })
    .limit(batchSize)
    .select("_id label")
    .lean();

  for (const doc of processing) {
    const orderId = String(doc._id);
    const token = tokenOf(doc);
    const shipmentId = doc.label?.providerShipmentId;
    if (!token || !shipmentId) continue;

    try {
      const result = await runWithDeadline(
        (signal) => provider.getLabel(shipmentId, { signal }),
        LABEL_PURCHASE_TIMEOUT_MS,
        () => new Error("Tiempo de espera agotado consultando la guía"),
      );
      if (result.status === "ready") {
        const written = await recordLabelSuccess(orderId, token, result, now, [ShippingLabelStatus.PROCESSING]);
        if (written) summary.refreshed += 1;
      }
    } catch (error) {
      // Consultar no tiene efectos: un error aquí solo se reintenta en el
      // siguiente tick, la guía sigue `processing`.
      logger.warn({ err: error, orderId }, "No se pudo consultar la guía en proceso");
    }
  }
}

async function reviewDeadLabels(now: Date, batchSize: number, summary: ShippingLabelsSummary) {
  const deadRequests = await Order.find({
    "label.status": ShippingLabelStatus.REQUESTED,
    "label.requestedAt": { $lt: new Date(now.getTime() - LABEL_REQUEST_LEASE_MINUTES * MINUTE_MS) },
  })
    .limit(batchSize)
    .select("_id label")
    .lean();
  const stuckProcessing = await Order.find({
    "label.status": ShippingLabelStatus.PROCESSING,
    "label.requestedAt": { $lt: new Date(now.getTime() - LABEL_PROCESSING_MAX_HOURS * HOUR_MS) },
  })
    .limit(batchSize)
    .select("_id label")
    .lean();

  const candidates = [
    ...deadRequests.map((doc) => ({ doc, reason: DEAD_REQUEST_REASON, writable: [ShippingLabelStatus.REQUESTED] })),
    ...stuckProcessing.map((doc) => ({ doc, reason: STUCK_PROCESSING_REASON, writable: [ShippingLabelStatus.PROCESSING] })),
  ];

  for (const { doc, reason, writable } of candidates) {
    const token = tokenOf(doc);
    if (!token) continue;
    try {
      const written = await recordLabelNeedsReview(String(doc._id), token, reason, now, writable);
      if (written) summary.reviewed += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error({ err: error, orderId: String(doc._id) }, "Falló el barrido de guías a medias");
    }
  }
}

async function reconcileStuckOrders(batchSize: number, summary: ShippingLabelsSummary) {
  // (a) Guía lista sobre una orden que sigue `paid`. Con contracargo abierto no
  // se despacha: se excluye de la consulta para no reintentarla cada minuto.
  const readyButPaid = await Order.find({
    status: OrderStatus.PAID,
    "label.status": ShippingLabelStatus.READY,
    disputeStatus: { $ne: DisputeStatus.OPEN },
  })
    .limit(batchSize)
    .select("_id")
    .lean();

  for (const doc of readyButPaid) {
    try {
      const result = await applySystemOrderTransition({
        orderId: String(doc._id),
        from: OrderStatus.PAID,
        to: OrderStatus.PROCESSING,
        reason: "Guía de envío generada",
      });
      if (result.outcome === "applied") summary.reconciled += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error({ err: error, orderId: String(doc._id) }, "Falló la reconciliación de una guía lista");
    }
  }

  // (b) Rastreo más adelantado que la orden. Despachar (`shipped`) exige no
  // tener contracargo abierto; cerrar la entrega desde `shipped` no.
  const behindTracking = await Order.find({
    $or: [
      {
        status: { $in: [OrderStatus.PAID, OrderStatus.PROCESSING] },
        "tracking.status": {
          $in: [
            ShipmentTrackingStatus.PICKED_UP,
            ShipmentTrackingStatus.IN_TRANSIT,
            ShipmentTrackingStatus.OUT_FOR_DELIVERY,
            ShipmentTrackingStatus.DELIVERED,
          ],
        },
        // Sin guía lista no hay de dónde armar el envío: no tiene caso reintentar.
        "label.trackingNumber": { $exists: true },
        disputeStatus: { $ne: DisputeStatus.OPEN },
      },
      { status: OrderStatus.SHIPPED, "tracking.status": ShipmentTrackingStatus.DELIVERED },
    ],
  })
    .limit(batchSize)
    .select("_id")
    .lean();

  for (const doc of behindTracking) {
    try {
      const effect = await convergeOrderWithTracking(String(doc._id));
      if (effect === "applied") summary.reconciled += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error({ err: error, orderId: String(doc._id) }, "Falló la reconciliación del rastreo");
    }
  }
}

async function processShippingLabels(
  now = new Date(),
  batchSize = 100,
  provider: ShippingProvider | undefined = resolveShippingProvider(),
): Promise<ShippingLabelsSummary> {
  const summary: ShippingLabelsSummary = { dispatched: 0, refreshed: 0, reviewed: 0, reconciled: 0, failed: 0 };

  if (provider) {
    await dispatchDueLabels(now, batchSize, provider, summary);
    await refreshProcessingLabels(now, batchSize, provider, summary);
  }
  await reviewDeadLabels(now, batchSize, summary);
  await reconcileStuckOrders(batchSize, summary);

  return summary;
}

export { processShippingLabels };
export type { ShippingLabelsSummary };
