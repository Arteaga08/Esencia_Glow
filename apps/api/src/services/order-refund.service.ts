import { DisputeStatus, OrderAction, PaymentMethod, REFUND_REQUEST_LEASE_MINUTES } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { verifyTwoFactorCode } from "./two-factor.service.js";
import { recordAudit } from "./audit.service.js";
import { resolvePaymentProvider, type PaymentProvider } from "./payment-provider.js";
import { REFUNDABLE_ORDER_STATUSES } from "./order-state.js";

/**
 * `requestOrderRefund` — `POST /admin/orders/:id/refund` (§5 del plan de
 * 1.6.3). Reembolso TOTAL únicamente: el monto siempre es el remanente
 * (`totalCents - refundedAmountCents`), nunca un parcial pedido desde
 * nuestra API (decisión 2 del plan de 1.6).
 *
 * Orden de validaciones (decisión 9 del plan de 1.6 + decisión 8 de
 * 1.6.3): el step-up 2FA va PRIMERO — sin código válido, esta función
 * nunca llega a leer la orden ni a tocar Stripe. Un admin sin 2FA activo
 * nunca llega a `verifyTwoFactorCode` (403 explícito, en vez del 400
 * genérico que usaría ese servicio para otros flujos).
 */

interface RequestOrderRefundInput {
  orderId: string;
  adminId: string;
  twoFactorCode: string;
  reason?: string;
  /** Inyectable para tests — en producción se resuelve por configuración. */
  provider?: PaymentProvider;
}

/**
 * Mutex con lease sobre `payment.refundRequestedAt` (decisión 3 del plan de
 * 1.6.3): dos solicitudes concurrentes (doble clic, dos pestañas) para el
 * MISMO pedido nunca disparan dos llamadas a Stripe — la que pierde el
 * claim ve 409. La llave de idempotencia hacia Stripe incluye el timestamp
 * del claim (`refundRequestedAt` en ms), así que un reintento tras un fallo
 * transitorio (campo ya desmarcado) usa una llave NUEVA en vez de revivir
 * la respuesta guardada de un intento previo con datos distintos.
 */
async function claimRefundRequest(orderId: string, now: Date): Promise<OrderDocument | null> {
  const leaseThreshold = new Date(now.getTime() - REFUND_REQUEST_LEASE_MINUTES * 60_000);
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      status: { $in: REFUNDABLE_ORDER_STATUSES },
      "payment.method": PaymentMethod.CARD,
      disputeStatus: { $ne: DisputeStatus.OPEN },
      $or: [{ "payment.refundRequestedAt": { $exists: false } }, { "payment.refundRequestedAt": { $lt: leaseThreshold } }],
    },
    { $set: { "payment.refundRequestedAt": now } },
    { new: true },
  );
}

/** Libera el mutex SOLO si sigue siendo el que esta llamada puso (fencing
 * por valor): si otra llamada ya lo reclamó de nuevo mientras tanto, esta
 * no debe pisarla. */
async function releaseRefundClaim(orderId: string, claimedAt: Date): Promise<void> {
  await Order.updateOne(
    { _id: orderId, "payment.refundRequestedAt": claimedAt },
    { $unset: { "payment.refundRequestedAt": "" } },
  );
}

async function requestOrderRefund(input: RequestOrderRefundInput): Promise<OrderDocument> {
  const admin = await User.findById(input.adminId);
  if (!admin) throw new AppError("Administrador no encontrado.", 404);
  if (!admin.twoFactor.enabled) {
    throw new AppError("Activa la verificación en dos pasos para reembolsar.", 403);
  }
  await verifyTwoFactorCode(input.adminId, input.twoFactorCode);

  const provider = "provider" in input ? input.provider : resolvePaymentProvider();
  if (!provider) throw new AppError("Los pagos no están configurados.", 503);

  const order = await Order.findById(input.orderId);
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  if (!REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
    throw new AppError(`No se puede reembolsar un pedido en estado "${order.status}".`, 409);
  }
  if (order.payment.method === PaymentMethod.OXXO) {
    throw new AppError("Los pagos OXXO no se pueden reembolsar por Stripe.", 409);
  }
  if (order.disputeStatus === DisputeStatus.OPEN) {
    throw new AppError("El pedido tiene un contracargo abierto.", 409);
  }
  const remainingCents = order.totalCents - (order.payment.refundedAmountCents ?? 0);
  if (remainingCents <= 0) {
    throw new AppError("Este pedido ya fue reembolsado por completo.", 409);
  }
  if (!order.payment.intentId) {
    throw new AppError("Este pedido no tiene un pago asociado.", 409);
  }

  const now = new Date();
  const claimed = await claimRefundRequest(input.orderId, now);
  if (!claimed) {
    throw new AppError("Ya hay un reembolso en proceso para este pedido.", 409);
  }

  // Recomputado desde el documento RECLAMADO, no desde la lectura de arriba
  // (hallazgo de code review): un reembolso parcial concurrente — hecho
  // desde el Dashboard de Stripe justo entre la lectura y este claim — ya
  // se reflejaría en `claimed`, y usar el valor viejo mandaría a Stripe un
  // monto mayor al que en realidad queda disponible.
  const claimedRemainingCents = claimed.totalCents - (claimed.payment.refundedAmountCents ?? 0);
  if (claimedRemainingCents <= 0) {
    await releaseRefundClaim(input.orderId, now);
    throw new AppError("Este pedido ya fue reembolsado por completo.", 409);
  }

  let result: Awaited<ReturnType<PaymentProvider["refund"]>>;
  try {
    result = await provider.refund({
      orderId: input.orderId,
      intentId: claimed.payment.intentId!,
      amountCents: claimedRemainingCents,
      idempotencyKey: `order:${input.orderId}:refund:${now.getTime()}`,
      requestedAtMs: now.getTime(),
    });
  } catch (error) {
    await releaseRefundClaim(input.orderId, now);
    throw error;
  }

  // `provider.refund` puede RESOLVER (sin lanzar) con un rechazo síncrono
  // de Stripe (hallazgo de code review) — nunca tratarlo como éxito: el
  // mutex se libera igual que en el `catch` de arriba, y no se audita una
  // solicitud que Stripe ya rechazó.
  if (result.status === "failed") {
    await releaseRefundClaim(input.orderId, now);
    throw new AppError("El procesador de pagos rechazó el reembolso.", 502);
  }

  await recordAudit({
    action: OrderAction.ORDER_REFUND_REQUESTED,
    actorId: input.adminId,
    targetId: input.orderId,
    metadata: { amountCents: claimedRemainingCents, ...(input.reason ? { reason: input.reason } : {}) },
  });

  return claimed;
}

export { requestOrderRefund };
export type { RequestOrderRefundInput };
