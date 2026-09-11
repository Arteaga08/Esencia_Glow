import { Types, type ClientSession } from "mongoose";
import { MAX_STATUS_HISTORY, OrderAction, OrderStatus, type ShippingCarrier } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { assertTransition, getTransitionInventoryEffect } from "./order-state.js";
import { releaseReservationDetailed, auditReleaseMismatches } from "./stock-reservation.service.js";
import { recordAudit } from "./audit.service.js";
import { logger } from "../config/logger.js";
import { closePendingOrder } from "./order-closing.service.js";
import type { LeanOrder } from "./order-dto.js";

/**
 * Transiciones de estado + guía del panel admin sobre una orden (§J del
 * plan de 1.5). Separado de `order-admin-fields.service.ts` (dirección,
 * prioridad, notas) y de `order-admin.service.ts` (solo lectura) por el
 * tope de 250 líneas por archivo del repo.
 */

interface ShipmentInput {
  carrier: ShippingCarrier;
  carrierName?: string;
  trackingNumber: string;
  trackingUrl?: string;
}

interface ChangeOrderStatusInput {
  orderId: string;
  targetStatus: OrderStatus;
  adminId: string;
  reason?: string;
  /** Requerido SOLO cuando `targetStatus === "shipped"` — la transición
   * `processing -> shipped` va "con guía" (ver order-state.ts §D). */
  shipment?: ShipmentInput;
}

interface ChangeOrderStatusCoreResult {
  order: LeanOrder;
  previousStatus: OrderStatus;
  releasedInconsistentVariants: { variantId: Types.ObjectId; sku: string }[];
}

/**
 * `findById` primero SOLO para decidir el mensaje/efecto — el
 * `findOneAndUpdate` con el estado origen en el filtro es el guard real
 * (§D regla 1): si otro admin cambió el estado entre medias, `claimed` sale
 * `null` y esta llamada pierde limpio con 409 (ver el test de dos PATCH
 * concurrentes).
 */
async function changeOrderStatusCore(
  input: ChangeOrderStatusInput,
  session: ClientSession,
): Promise<ChangeOrderStatusCoreResult> {
  const current = await Order.findById(input.orderId).session(session);
  if (!current) throw new AppError("Pedido no encontrado.", 404);

  assertTransition(current.status, input.targetStatus, "admin");

  if (input.targetStatus === OrderStatus.SHIPPED && !input.shipment) {
    throw new AppError("Debes indicar la guía (paquetería y número de rastreo) al marcar como enviado.", 400);
  }

  const now = new Date();
  const adminObjectId = new Types.ObjectId(input.adminId);
  const setFields: Record<string, unknown> = { status: input.targetStatus };
  if (input.targetStatus === OrderStatus.SHIPPED && input.shipment) {
    setFields.shipment = { ...input.shipment, shippedAt: now };
  }

  const claimed = await Order.findOneAndUpdate(
    { _id: input.orderId, status: current.status },
    {
      $set: setFields,
      $push: {
        statusHistory: {
          $each: [
            {
              status: input.targetStatus,
              at: now,
              actorType: "user",
              actorId: adminObjectId,
              ...(input.reason ? { reason: input.reason } : {}),
            },
          ],
          $slice: -MAX_STATUS_HISTORY,
        },
      },
    },
    { new: true, session },
  ).lean<LeanOrder>();

  if (!claimed) {
    throw new AppError("El pedido cambió de estado antes de poder aplicar esta transición, intenta de nuevo.", 409);
  }

  const effect = getTransitionInventoryEffect(current.status, input.targetStatus);
  if (effect === "release") {
    const release = await releaseReservationDetailed(claimed.reservationId.toString(), session);
    return { order: claimed, previousStatus: current.status, releasedInconsistentVariants: release.inconsistentVariants };
  }

  return { order: claimed, previousStatus: current.status, releasedInconsistentVariants: [] };
}

/**
 * `pending -> cancelled` desde el admin delega en `closePendingOrder`
 * (Milestone 1.6.2, decisión 1 del plan): "Stripe-first" — si el pedido ya
 * tiene un PaymentIntent, se consulta/cancela en Stripe ANTES de liberar
 * inventario, igual que la cancelación del cliente y el barrendero. Sin
 * esto, un admin podía cancelar y liberar stock de un pedido cuyo cobro
 * Stripe ya estaba procesando, dejando un pago capturado sobre un pedido
 * `cancelled` (anomalía + reembolso manual). Se decide ANTES de abrir la
 * transacción de `changeOrderStatusCore`: `closePendingOrder` administra
 * su propia transacción, así que anidar sería doble transacción para nada.
 */
async function changeOrderStatus(input: ChangeOrderStatusInput): Promise<LeanOrder> {
  if (input.targetStatus === OrderStatus.CANCELLED) {
    const current = await Order.findById(input.orderId).select("status").lean();
    if (!current) throw new AppError("Pedido no encontrado.", 404);
    if (current.status === OrderStatus.PENDING) {
      const result = await closePendingOrder(input.orderId, "admin", { actorId: input.adminId, reason: input.reason });
      if (result.outcome === "already_paid") {
        throw new AppError("El pago de este pedido ya se procesó; no se puede cancelar.", 409);
      }
      if (result.outcome === "payment_anomaly") {
        // La orden sigue `pending` (no se pagó), marcada para revisión —
        // ver `payment-settlement.service.ts`. Decirle al admin "ya se
        // procesó" sería falso y le cerraría la única pista de por qué el
        // pedido no se puede cancelar todavía.
        throw new AppError(
          "Este pedido tiene una anomalía de pago pendiente de revisión; no se puede cancelar hasta resolverla.",
          409,
        );
      }
      return result.order!.toObject() as unknown as LeanOrder;
    }
  }

  const result = await withTransaction((session) => changeOrderStatusCore(input, session));

  if (result.releasedInconsistentVariants.length > 0) {
    await auditReleaseMismatches(result.order.reservationId.toString(), result.releasedInconsistentVariants);
  }

  const action = input.targetStatus === OrderStatus.CANCELLED ? OrderAction.ORDER_CANCELLED : OrderAction.ORDER_STATUS_CHANGED;
  await recordAudit({
    action,
    actorId: input.adminId,
    targetId: result.order._id,
    metadata: { from: result.previousStatus, to: input.targetStatus },
  });
  if (input.targetStatus === OrderStatus.SHIPPED) {
    await recordAudit({ action: OrderAction.ORDER_SHIPMENT_UPDATED, actorId: input.adminId, targetId: result.order._id });
  }

  return result.order;
}

interface UpdateOrderShipmentInput {
  orderId: string;
  adminId: string;
  carrier?: ShippingCarrier;
  carrierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

/**
 * Corrige la guía EN SITIO, sin tocar `status` — para eso ya se envió por
 * `changeOrderStatus`. Solo aplica si la orden ya tiene una guía (llegó a
 * `shipped` al menos una vez). El guard (`shipment: {$exists: true}`) viaja
 * en el MISMO `findOneAndUpdate`, no en un `findById` previo: un `read`
 * separado del `write` dejaría una ventana donde otro admin pudiera borrar/
 * mover la orden entre medias (mismo principio que `changeOrderStatusCore`
 * §D regla 1, aplicado aquí a un campo en vez de a `status`).
 */
async function updateOrderShipment(input: UpdateOrderShipmentInput): Promise<LeanOrder> {
  const setFields: Record<string, unknown> = {};
  if (input.carrier !== undefined) setFields["shipment.carrier"] = input.carrier;
  if (input.carrierName !== undefined) setFields["shipment.carrierName"] = input.carrierName;
  if (input.trackingNumber !== undefined) setFields["shipment.trackingNumber"] = input.trackingNumber;
  if (input.trackingUrl !== undefined) setFields["shipment.trackingUrl"] = input.trackingUrl;

  const updated = await Order.findOneAndUpdate(
    { _id: input.orderId, shipment: { $exists: true } },
    { $set: setFields },
    { new: true },
  ).lean<LeanOrder>();

  if (!updated) {
    const exists = await Order.exists({ _id: input.orderId });
    if (!exists) throw new AppError("Pedido no encontrado.", 404);
    throw new AppError("El pedido aún no tiene guía; usa la transición a 'shipped' para crearla.", 409);
  }

  await recordAudit({ action: OrderAction.ORDER_SHIPMENT_UPDATED, actorId: input.adminId, targetId: updated._id });
  return updated;
}

interface BulkChangeStatusResultEntry {
  orderId: string;
  ok: boolean;
  error?: string;
}

/** Lote acotado a 50 ids (validado en el validator) y UNA entrada de audit
 * POR ORDEN — nunca una por lote, o el visor de auditoría pierde la orden
 * individual. Reusa `changeOrderStatus` id por id: cada uno pasa por la
 * MISMA `assertTransition` y el mismo guard de concurrencia. */
async function bulkChangeStatus(
  orderIds: string[],
  targetStatus: OrderStatus,
  adminId: string,
  reason?: string,
): Promise<BulkChangeStatusResultEntry[]> {
  const results: BulkChangeStatusResultEntry[] = [];
  for (const orderId of orderIds) {
    try {
      await changeOrderStatus({ orderId, targetStatus, adminId, reason });
      results.push({ orderId, ok: true });
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ err: error, orderId, targetStatus }, "Fallo inesperado al cambiar el estatus en lote");
      }
      results.push({ orderId, ok: false, error: error instanceof AppError ? error.message : "Error inesperado." });
    }
  }
  return results;
}

export { changeOrderStatus, updateOrderShipment, bulkChangeStatus };
export type { ChangeOrderStatusInput, ShipmentInput, UpdateOrderShipmentInput, BulkChangeStatusResultEntry };
