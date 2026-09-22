import { OrderAction, OrderStatus, ShippingLabelStatus } from "@esencia-glow/shared";
import { logger } from "../config/logger.js";
import { Order } from "../models/order.model.js";
import { recordAudit } from "./audit.service.js";
import { applySystemOrderTransition } from "./order-system-transition.service.js";
import { sendShippingLabelAlertEmail } from "./shipping-email.service.js";
import type { ShippingLabelResult } from "./shipping-provider.js";

/**
 * Efectos de "qué pasó con la guía": lo comparten `order-label.service.ts` (la
 * compra) y el barrido del job (`order-label-sweeps.ts`). Cada escritura que
 * sigue a una llamada al proveedor va con FENCING por el token del claim
 * (`requestedAt` + `attempts`): una respuesta tardía de un intento viejo no
 * puede pisar el resultado de uno nuevo.
 */

interface LabelClaimToken {
  requestedAt: Date;
  attempts: number;
}

/** Un ÉXITO se registra aunque el lease ya se haya mandado a revisión (el
 * dinero ya se gastó — perder la guía comprada sería peor); un FALLO solo
 * puede escribir mientras el claim siga vigente. */
const SUCCESS_WRITABLE_STATUSES = [ShippingLabelStatus.REQUESTED, ShippingLabelStatus.NEEDS_REVIEW];
const FAILURE_WRITABLE_STATUSES = [ShippingLabelStatus.REQUESTED];

function fencedFilter(orderId: string, token: LabelClaimToken, writable: ShippingLabelStatus[]) {
  return {
    _id: orderId,
    "label.status": { $in: writable },
    "label.requestedAt": token.requestedAt,
    "label.attempts": token.attempts,
  };
}

/** Actualización de `label` según lo que devolvió el proveedor. */
function buildLabelResultSet(result: ShippingLabelResult, now: Date): Record<string, unknown> {
  if (result.status === "processing") {
    return { "label.status": ShippingLabelStatus.PROCESSING, "label.providerShipmentId": result.providerShipmentId };
  }
  return {
    "label.status": ShippingLabelStatus.READY,
    "label.providerShipmentId": result.providerShipmentId,
    "label.trackingNumber": result.trackingNumber,
    "label.carrier": result.carrier,
    "label.labelUrl": result.labelUrl,
    ...(result.trackingUrl ? { "label.trackingUrl": result.trackingUrl } : {}),
    "label.readyAt": now,
  };
}

/** Guarda un resultado exitoso con fencing. `false` = el claim ya no era el
 * vigente (respuesta tardía de un intento viejo). */
async function recordLabelSuccess(
  orderId: string,
  token: LabelClaimToken,
  result: ShippingLabelResult,
  now: Date,
  writable: ShippingLabelStatus[] = SUCCESS_WRITABLE_STATUSES,
): Promise<boolean> {
  const updated = await Order.findOneAndUpdate(
    fencedFilter(orderId, token, writable),
    { $set: buildLabelResultSet(result, now), $unset: { "label.nextAttemptAt": "", "label.lastError": "" } },
    { new: true },
  ).lean();
  if (!updated) return false;

  if (result.status === "ready") await completeReadyLabel(orderId);
  return true;
}

/** Guía `ready`: audita y mueve `paid -> processing` como sistema. Si la
 * orden ya no está en `paid` (el admin la movió a mano) o hay un contracargo
 * abierto, la transición se omite — la guía ya quedó guardada, así que
 * nunca se pierde. */
async function completeReadyLabel(orderId: string): Promise<void> {
  await recordAudit({ action: OrderAction.LABEL_CREATED, targetId: orderId });
  try {
    await applySystemOrderTransition({
      orderId,
      from: OrderStatus.PAID,
      to: OrderStatus.PROCESSING,
      reason: "Guía de envío generada",
    });
  } catch (error) {
    logger.error({ err: error, orderId }, "No se pudo mover el pedido a processing tras generar la guía");
  }
}

/** Backoff exponencial: base * 2^(intento-1) minutos. */
function computeBackoffMs(attempts: number, baseMinutes: number): number {
  return baseMinutes * 2 ** Math.max(0, attempts - 1) * 60_000;
}

/** Guarda un rechazo reintentable: `failed` con el siguiente intento agendado. */
async function recordLabelFailure(
  orderId: string,
  token: LabelClaimToken,
  reason: string,
  nextAttemptAt: Date,
): Promise<boolean> {
  const updated = await Order.findOneAndUpdate(
    fencedFilter(orderId, token, FAILURE_WRITABLE_STATUSES),
    { $set: { "label.status": ShippingLabelStatus.FAILED, "label.lastError": reason, "label.nextAttemptAt": nextAttemptAt } },
  );
  if (!updated) return false;
  await recordAudit({ action: OrderAction.LABEL_FAILED, targetId: orderId, metadata: { attempt: token.attempts } });
  return true;
}

/**
 * Manda la guía a revisión humana y alerta al admin (una sola vez por paso a
 * `needs_review`). Nunca se recompra sola desde aquí.
 */
async function recordLabelNeedsReview(
  orderId: string,
  token: LabelClaimToken,
  reason: string,
  now: Date,
  writable: ShippingLabelStatus[] = FAILURE_WRITABLE_STATUSES,
): Promise<boolean> {
  const updated = await Order.findOneAndUpdate(
    fencedFilter(orderId, token, writable),
    {
      $set: { "label.status": ShippingLabelStatus.NEEDS_REVIEW, "label.lastError": reason },
      $unset: { "label.nextAttemptAt": "" },
    },
    { new: true },
  ).lean();
  if (!updated) return false;

  await recordAudit({ action: OrderAction.LABEL_NEEDS_REVIEW, targetId: orderId, metadata: { attempt: token.attempts } });
  await alertLabelNeedsReview(orderId, updated.orderNumber, reason, now);
  return true;
}

/** El CAS sobre `adminAlertedAt` garantiza UNA alerta por paso a
 * `needs_review`, aunque dos procesos lleguen a la vez. (Si el correo falla o
 * no hay `ADMIN_ALERT_EMAIL`, la guía igual se ve en el panel.) */
async function alertLabelNeedsReview(
  orderId: string,
  orderNumber: string,
  reason: string,
  now: Date,
): Promise<void> {
  const sealed = await Order.updateOne(
    { _id: orderId, "label.status": ShippingLabelStatus.NEEDS_REVIEW, "label.adminAlertedAt": { $exists: false } },
    { $set: { "label.adminAlertedAt": now } },
  );
  if (sealed.modifiedCount === 0) return;
  await sendShippingLabelAlertEmail({ orderId, orderNumber, alertedAt: now, reason });
}

export {
  recordLabelSuccess,
  recordLabelFailure,
  recordLabelNeedsReview,
  alertLabelNeedsReview,
  completeReadyLabel,
  computeBackoffMs,
};
export type { LabelClaimToken };
