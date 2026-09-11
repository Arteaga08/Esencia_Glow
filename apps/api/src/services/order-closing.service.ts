import { MAX_STATUS_HISTORY, OrderAction, OrderStatus, PaymentMethod } from "@esencia-glow/shared";
import { Types, type FilterQuery } from "mongoose";
import { Order, type OrderAttrs, type OrderDocument } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { assertTransition } from "./order-state.js";
import { releaseReservationDetailed, auditReleaseMismatches } from "./stock-reservation.service.js";
import { recordAudit } from "./audit.service.js";
import { resolvePaymentProvider, type PaymentProvider } from "./payment-provider.js";
import { settleCapturedPayment } from "./payment-settlement.service.js";

/**
 * `closePendingOrder` — único camino para cerrar un pedido `pending`
 * (§D del plan de 1.6): usado por la cancelación del cliente, el barrendero
 * de expiración y el reconciliador. "Stripe-first": si ya existe un
 * PaymentIntent, se consulta/cancela en Stripe ANTES de tocar inventario —
 * nunca se cancela localmente un pedido cuyo pago Stripe ya procesó.
 */

type CloseActor = "customer" | "admin" | "system";
type CloseOutcome = "closed" | "already_paid";

interface ClosePendingOrderOptions {
  /** Requerido cuando `actor === "customer"` — anti-IDOR: filtro de
   * propiedad, nunca un check posterior. */
  userId?: string;
  reason?: string;
  /** Inyectable para tests — en producción se resuelve por configuración. */
  provider?: PaymentProvider;
}

interface CloseResult {
  outcome: CloseOutcome;
  order: OrderDocument | null;
  /** true SOLO si ESTA llamada hizo la transición `pending -> cancelled`.
   * El barrendero (cancel-expired-orders.ts) lo usa para no contar dos
   * veces la misma orden cuando dos ejecuciones concurrentes la alcanzan —
   * mismo criterio que `ReleaseResult.transitioned` en
   * stock-reservation.service.ts. */
  transitioned: boolean;
}

/** Claim `pending -> cancelled` + release de la reserva, en una sola
 * transacción — mismo patrón que `cancelMyOrder`/`cancelExpiredOrders` de
 * 1.5. Único camino de escritura del cierre "sin más que hacer con Stripe". */
async function claimAndRelease(
  filter: FilterQuery<OrderAttrs>,
  actor: CloseActor,
  actorId: string | undefined,
  reason: string | undefined,
): Promise<CloseResult> {
  const { order: claimed, releaseResult, alreadyClosed } = await withTransaction(async (session) => {
    const now = new Date();
    const claimedOrder = await Order.findOneAndUpdate(
      { ...filter, status: OrderStatus.PENDING },
      {
        $set: { status: OrderStatus.CANCELLED, ...(reason ? { cancelReason: reason } : {}) },
        $push: {
          statusHistory: {
            $each: [
              {
                status: OrderStatus.CANCELLED,
                at: now,
                actorType: actor === "system" ? "system" : "user",
                ...(actorId ? { actorId: new Types.ObjectId(actorId) } : {}),
                ...(reason ? { reason } : {}),
              },
            ],
            $slice: -MAX_STATUS_HISTORY,
          },
        },
      },
      { new: true, session },
    );

    if (!claimedOrder) {
      const existing = await Order.findOne(filter).session(session);
      if (!existing) throw new AppError("Pedido no encontrado.", 404);
      if (existing.status === OrderStatus.CANCELLED) {
        // Perdedora de una carrera de cierre (barrendero vs. cliente vs.
        // otro tick del cron): el trabajo ya está hecho, no es un error.
        return { order: existing, releaseResult: { inconsistentVariants: [] }, alreadyClosed: true as const };
      }
      throw new AppError(`No se puede cancelar un pedido en estado "${existing.status}".`, 409);
    }

    const release = await releaseReservationDetailed(claimedOrder.reservationId.toString(), session);
    return { order: claimedOrder, releaseResult: release, alreadyClosed: false as const };
  });

  if (alreadyClosed) {
    return { outcome: "closed", order: claimed, transitioned: false };
  }

  if (releaseResult.inconsistentVariants.length > 0) {
    await auditReleaseMismatches(claimed.reservationId.toString(), releaseResult.inconsistentVariants);
  }
  await recordAudit({ action: OrderAction.ORDER_CANCELLED, ...(actorId ? { actorId } : {}), targetId: claimed._id });

  return { outcome: "closed", order: claimed, transitioned: true };
}

/** Sella `adminAlertedAt` una sola vez (no lo pisa si ya estaba) y audita
 * la anomalía — mismo criterio que `payment-settlement.service.ts`, sin
 * transicionar la orden: no sabemos todavía si el pago se va a capturar o
 * a fallar. */
async function flagOrderForReview(orderId: string, reason: string): Promise<void> {
  await Order.findOneAndUpdate(
    { _id: orderId, adminAlertedAt: { $exists: false } },
    { $set: { adminAlertedAt: new Date() } },
  );
  await recordAudit({ action: OrderAction.ORDER_PAYMENT_ANOMALY, targetId: orderId, metadata: { reason } });
}

function buildOwnershipFilter(actor: CloseActor, orderId: string, userId?: string): FilterQuery<OrderAttrs> {
  if (actor === "customer") {
    if (!userId) throw new AppError("Falta el usuario dueño del pedido.", 500);
    return { _id: orderId, userId };
  }
  return { _id: orderId };
}

async function closePendingOrder(
  orderId: string,
  actor: CloseActor,
  options: ClosePendingOrderOptions = {},
): Promise<CloseResult> {
  assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED, actor);
  const filter = buildOwnershipFilter(actor, orderId, options.userId);

  const order = await Order.findOne(filter);
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  if (order.status === OrderStatus.CANCELLED) {
    // Idempotente: dos cierres concurrentes (el barrendero y el propio
    // cliente, o dos ticks del cron compitiendo) no deben tratarse como un
    // error — el perdedor de la carrera simplemente encuentra el trabajo
    // ya hecho, mismo criterio que `already_committed` en
    // stock-reservation.service.ts.
    return { outcome: "closed", order, transitioned: false };
  }
  if (order.status !== OrderStatus.PENDING) {
    throw new AppError(`No se puede cancelar un pedido en estado "${order.status}".`, 409);
  }

  if (!order.payment.intentId) {
    return claimAndRelease(filter, actor, options.userId, options.reason);
  }

  const provider = "provider" in options ? options.provider : resolvePaymentProvider();
  if (!provider) {
    throw new AppError("Los pagos no están configurados.", 503);
  }

  if (order.payment.method === PaymentMethod.CARD) {
    const cancelOutcome = await provider.cancel(order.payment.intentId, `order:${orderId}:cancel`);
    if (cancelOutcome === "already_captured") {
      const authorization = await provider.getAuthorization(order.payment.intentId);
      const settlement = await settleCapturedPayment(orderId, authorization);
      return { outcome: "already_paid", order: settlement.order, transitioned: false };
    }
    if (cancelOutcome === "not_cancelable") {
      // El PI está en un estado intermedio (p. ej. `processing`, una
      // captura async en curso) donde Stripe ni confirma ni permite
      // cancelar todavía. Cancelar aquí sería apostar a que el pago fallará
      // — si luego se captura, el stock ya estaría liberado/revendido. Se
      // deja `pending`, se marca para revisión humana, y NUNCA se libera
      // inventario a ciegas.
      await flagOrderForReview(orderId, "El pago está en un estado intermedio en Stripe (ni confirmado ni cancelable).");
      throw new AppError(
        "No se pudo cancelar: tu pago está siendo procesado. Contacta a soporte si esto persiste.",
        409,
      );
    }
    return claimAndRelease(filter, actor, options.userId, options.reason);
  }

  // OXXO: la ficha NO se puede cancelar antes de vencer (límite real de
  // Stripe) — un pedido con ficha vigente solo puede resolverse solo
  // (el cliente paga o la ficha vence), nunca cancelarse a mano.
  const voucherExpiresAt = order.payment.voucherExpiresAt;
  if (voucherExpiresAt && voucherExpiresAt.getTime() > Date.now()) {
    throw new AppError(
      "No puedes cancelar un pedido con ficha OXXO vigente; si no la pagas, se cancelará sola.",
      409,
    );
  }

  const authorization = await provider.getAuthorization(order.payment.intentId);
  if (authorization.status === "captured") {
    const settlement = await settleCapturedPayment(orderId, authorization);
    return { outcome: "already_paid", order: settlement.order, transitioned: false };
  }

  // Best-effort: la ficha ya venció, Stripe normalmente rechaza el cancel
  // (PI ya no está en un estado cancelable) — el resultado no cambia el
  // cierre local, que es lo que de verdad importa aquí.
  await provider.cancel(order.payment.intentId, `order:${orderId}:cancel`).catch(() => undefined);
  return claimAndRelease(filter, actor, options.userId, options.reason);
}

export { closePendingOrder };
export type { CloseActor, CloseOutcome, ClosePendingOrderOptions, CloseResult };
