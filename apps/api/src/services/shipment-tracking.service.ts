import { OrderAction, OrderStatus, type ShipmentTrackingStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { ShipmentTrackingEvent } from "../models/shipment-tracking-event.model.js";
import { isDuplicateKeyError } from "../utils/duplicate-key-error.js";
import { recordAudit } from "./audit.service.js";
import { applySystemOrderTransition } from "./order-system-transition.service.js";
import type { ShipmentInput } from "./order-status-claim.js";
import { buildTrackingClaimFilter, orderTargetFor } from "./shipment-tracking-state.js";

/**
 * Sub-recurso de rastreo (Milestone 1.9): registra un evento de la paquetería
 * en la bitácora, avanza el estado agregado de la orden (`Order.tracking`) y
 * de él cuelgan las transiciones automáticas de la orden como actor `system`.
 *
 * Los proveedores entregan eventos duplicados y fuera de orden, así que TODO
 * aquí es idempotente y convergente: el log guarda cada evento una vez
 * (índice único), el estado solo avanza (CAS atómico, ver
 * `shipment-tracking-state.ts`), y las transiciones de orden son CAS. Ante un
 * evento duplicado igual se reintenta el CAS y los efectos: si un intento
 * anterior murió entre guardar el evento y aplicarlo, la reentrega del
 * proveedor lo completa.
 */

type TrackingOrderEffect = "none" | "applied" | "skipped_state" | "skipped_dispute" | "skipped_no_label";

interface RecordTrackingEventInput {
  orderId: string;
  provider: "stub" | "skydropx";
  providerEventId: string;
  status: ShipmentTrackingStatus;
  occurredAt: Date;
  description?: string;
  location?: string;
}

interface RecordTrackingEventResult {
  outcome: "recorded" | "duplicate" | "order_not_found";
  /** `true` si este evento movió `Order.tracking`. */
  trackingChanged: boolean;
  orderEffect: TrackingOrderEffect;
}

/** Camino de despacho de una orden pagada; cada paso lo toma `system`. */
const DISPATCH_PATH: readonly OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

type OrderLabelSnapshot = { trackingNumber?: string; carrier?: ShipmentInput["carrier"]; trackingUrl?: string } | undefined;

/** La guía del envío sale de la etiqueta que compramos; sin ella no hay de
 * dónde armar `Order.shipment`. */
function shipmentFromLabel(label: OrderLabelSnapshot): ShipmentInput | undefined {
  if (!label?.trackingNumber || !label.carrier) return undefined;
  return {
    carrier: label.carrier,
    trackingNumber: label.trackingNumber,
    ...(label.trackingUrl ? { trackingUrl: label.trackingUrl } : {}),
  };
}

/**
 * Lleva la orden por el camino de despacho hasta `target`, un paso a la vez
 * (cada uno un CAS). Un evento de entrega sobre una orden que seguía en
 * `processing` la pasa primero por `shipped`. Acotado a la longitud del camino
 * para que una carrera contra otro escritor no pueda ciclar.
 */
async function advanceOrderTowards(orderId: string, target: OrderStatus, status: ShipmentTrackingStatus): Promise<TrackingOrderEffect> {
  let applied = false;
  for (let step = 0; step < DISPATCH_PATH.length; step += 1) {
    const order = await Order.findById(orderId).select("status label").lean();
    if (!order) return applied ? "applied" : "none";

    const index = DISPATCH_PATH.indexOf(order.status);
    if (index === -1) return applied ? "applied" : "skipped_state"; // pending / cancelled / refunded
    if (index >= DISPATCH_PATH.indexOf(target)) return applied ? "applied" : "none"; // ya está ahí (o más allá)

    const next = DISPATCH_PATH[index + 1]!;
    const shipment = next === OrderStatus.SHIPPED ? shipmentFromLabel(order.label) : undefined;
    if (next === OrderStatus.SHIPPED && !shipment) return applied ? "applied" : "skipped_no_label";

    const result = await applySystemOrderTransition({
      orderId,
      from: order.status,
      to: next,
      reason: `Rastreo del proveedor: ${status}`,
      ...(shipment ? { shipment } : {}),
    });
    if (result.outcome === "skipped_dispute") {
      await recordAudit({
        action: OrderAction.TRACKING_TRANSITION_SKIPPED_DISPUTE,
        targetId: orderId,
        metadata: { status, wouldMoveTo: next },
      });
      return "skipped_dispute";
    }
    if (result.outcome === "applied") applied = true;
    // skipped_state: otro escritor movió la orden entre medias — se relee y se reevalúa.
  }
  return applied ? "applied" : "none";
}

async function recordTrackingEvent(input: RecordTrackingEventInput): Promise<RecordTrackingEventResult> {
  const exists = await Order.exists({ _id: input.orderId });
  if (!exists) return { outcome: "order_not_found", trackingChanged: false, orderEffect: "none" };

  let duplicate = false;
  try {
    await ShipmentTrackingEvent.create({
      orderId: input.orderId,
      provider: input.provider,
      providerEventId: input.providerEventId,
      status: input.status,
      occurredAt: input.occurredAt,
      ...(input.description ? { description: input.description } : {}),
      ...(input.location ? { location: input.location } : {}),
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    duplicate = true;
  }

  const advanced = await Order.findOneAndUpdate(
    { _id: input.orderId, ...buildTrackingClaimFilter({ status: input.status, occurredAt: input.occurredAt }) },
    { $set: { tracking: { status: input.status, lastEventAt: input.occurredAt } } },
    { new: true },
  ).lean();

  const outcome = duplicate ? "duplicate" : "recorded";
  if (advanced) {
    await recordAudit({ action: OrderAction.TRACKING_UPDATED, targetId: input.orderId, metadata: { status: input.status } });
  }

  // La orden se converge hacia el rastreo VIGENTE, no hacia este evento: así
  // una reentrega termina el trabajo de un intento que murió a media
  // transición (el rastreo ya avanzó pero la orden no), y un evento viejo que
  // no movió el rastreo nunca arrastra a la orden hacia atrás.
  const orderEffect = await convergeOrderWithTracking(input.orderId);
  return { outcome, trackingChanged: Boolean(advanced), orderEffect };
}

/**
 * Lleva la orden hacia donde el rastreo vigente dice que debería estar.
 * Idempotente: si ya está ahí no hace nada. Lo usan la reentrega de un evento
 * y el barrido del job (`jobs/process-shipping-labels.ts`) para completar
 * transiciones que quedaron a medias o que un contracargo dejó en pausa.
 */
async function convergeOrderWithTracking(orderId: string): Promise<TrackingOrderEffect> {
  const order = await Order.findById(orderId).select("tracking").lean();
  const status = order?.tracking?.status;
  const target = status ? orderTargetFor(status) : null;
  if (!status || !target) return "none";
  return advanceOrderTowards(orderId, target, status);
}

export { recordTrackingEvent, convergeOrderWithTracking };
export type { RecordTrackingEventInput, RecordTrackingEventResult, TrackingOrderEffect };
