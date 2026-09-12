import { applyProviderRefund, recordRefundFailure } from "./order-refund-settlement.service.js";
import { openDispute, closeDispute } from "./order-dispute.service.js";
import type { PaymentWebhookEvent } from "./payment-provider.js";
import { locateOrderForEvent, type HandlerOutcome } from "./payment-event-handlers.js";

/**
 * Handlers de los eventos que solo pueden llegar DESPUÉS de un pago
 * capturado (§7 del plan de 1.6.3): reembolsos y disputas. Archivo aparte
 * de `payment-event-handlers.ts` (156 líneas, ya en el tope) — mismo
 * criterio que separó `card-payment-attempts.service.ts`.
 *
 * A diferencia de `handleCaptured`/`handleFailed`/`handleCanceled`
 * (`payment-event-handlers.ts`), estos handlers localizan la orden
 * SOLO por `payment.intentId` — sin adoptar `metadata.orderId` como
 * respaldo. Un reembolso o una disputa solo existen sobre un pago YA
 * capturado, y para ese momento `markOrderPaid` ya persistió el intent en
 * la orden (ver payment-provider.ts, comentario del tipo `PaymentWebhookEvent`).
 */

type RefundedEvent = Extract<PaymentWebhookEvent, { kind: "payment.refunded" }>;
type RefundFailedEvent = Extract<PaymentWebhookEvent, { kind: "refund.failed" }>;
type DisputeOpenedEvent = Extract<PaymentWebhookEvent, { kind: "dispute.opened" }>;
type DisputeClosedEvent = Extract<PaymentWebhookEvent, { kind: "dispute.closed" }>;

/** Reusa `locateOrderForEvent` (payment-event-handlers.ts) con hint
 * `undefined` — sin adoptar `metadata.orderId`, exactamente la garantía
 * que documenta el comentario de arriba: un reembolso/disputa solo por
 * `payment.intentId`. */
function locateOrderByIntentId(intentId: string) {
  return locateOrderForEvent(intentId, undefined);
}

/** `charge.refunded` -> aplica lo que Stripe ya confirmó. Un
 * `amount_anomaly` (moneda distinta, monto mayor al total) es un rechazo de
 * NEGOCIO: reintentar la entrega del webhook no lo arregla. */
async function handleRefunded(event: RefundedEvent): Promise<HandlerOutcome> {
  const order = await locateOrderByIntentId(event.intentId);
  if (!order) return { status: "rejected", reason: "order_not_found" };

  const result = await applyProviderRefund(order._id.toString(), {
    amountRefundedCents: event.amountRefundedCents,
    currency: event.currency,
  });

  if (result.outcome === "amount_anomaly") {
    return { status: "rejected", reason: "amount_anomaly", orderId: order._id.toString() };
  }
  return { status: "processed", orderId: order._id.toString() };
}

/** `charge.refund.updated` con `status: failed|canceled` -> libera el mutex
 * de `payment.refundRequestedAt` para que un admin pueda reintentar. */
async function handleRefundFailed(event: RefundFailedEvent): Promise<HandlerOutcome> {
  const order = await locateOrderByIntentId(event.intentId);
  if (!order) return { status: "rejected", reason: "order_not_found" };

  await recordRefundFailure(order._id.toString(), {
    refundId: event.refundId,
    ...(event.reason ? { reason: event.reason } : {}),
    ...(event.requestedAtMs !== undefined ? { requestedAtMs: event.requestedAtMs } : {}),
  });
  return { status: "processed", orderId: order._id.toString() };
}

/** `charge.dispute.created` -> `disputeStatus: open`. No hay outcome de
 * negocio que rechazar aquí: abrir una disputa nunca "falla". */
async function handleDisputeOpened(event: DisputeOpenedEvent): Promise<HandlerOutcome> {
  const order = await locateOrderByIntentId(event.intentId);
  if (!order) return { status: "rejected", reason: "order_not_found" };

  await openDispute(order._id.toString());
  return { status: "processed", orderId: order._id.toString() };
}

/** `charge.dispute.closed` -> `disputeStatus: won|lost|withdrawn`
 * (la traducción del `status` crudo de Stripe vive en
 * `stripe-webhook-translator.ts`, no aquí). */
async function handleDisputeClosed(event: DisputeClosedEvent): Promise<HandlerOutcome> {
  const order = await locateOrderByIntentId(event.intentId);
  if (!order) return { status: "rejected", reason: "order_not_found" };

  await closeDispute(order._id.toString(), event.outcome);
  return { status: "processed", orderId: order._id.toString() };
}

export { handleRefunded, handleRefundFailed, handleDisputeOpened, handleDisputeClosed };
