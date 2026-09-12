import { logger } from "../config/logger.js";
import { claimPaymentEvent, completePaymentEvent, failPaymentEvent } from "./payment-event.service.js";
import { handleCaptured, handleFailed, handleCanceled, type HandlerOutcome } from "./payment-event-handlers.js";
import {
  handleRefunded,
  handleRefundFailed,
  handleDisputeOpened,
  handleDisputeClosed,
} from "./payment-post-capture-handlers.js";
import type { PaymentProvider, PaymentWebhookEvent } from "./payment-provider.js";

/**
 * Orquestador del webhook (§C/§D del plan de 1.6.2): reclama el evento
 * (dedupe), despacha al handler de su `kind`, y traduce el resultado a
 * `PaymentEvent.status`.
 *
 * Clasificación de errores (decisión 7): un handler que DEVUELVE
 * `rejected` es un rechazo de NEGOCIO (orden inexistente, montos que no
 * cuadran, pago tardío) -> `failed` + 200, reintentar no lo arregla.
 * Cualquier EXCEPCIÓN (DB caída, Stripe 502, un 409 inesperado) es
 * transitoria -> `failed` + la función relanza, y el controller responde
 * 500 para que Stripe reintente.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

async function dispatchPaymentEvent(event: PaymentWebhookEvent, provider: PaymentProvider): Promise<HandlerOutcome> {
  switch (event.kind) {
    case "payment.captured":
      return handleCaptured(event, provider);
    case "payment.failed":
      return handleFailed(event, provider);
    case "payment.canceled":
      return handleCanceled(event, provider);
    case "payment.refunded":
      return handleRefunded(event);
    case "refund.failed":
      return handleRefundFailed(event);
    case "dispute.opened":
      return handleDisputeOpened(event);
    case "dispute.closed":
      return handleDisputeClosed(event);
    case "ignored":
      return { status: "ignored" };
  }
}

async function processPaymentWebhook(event: PaymentWebhookEvent, provider: PaymentProvider): Promise<void> {
  const claim = await claimPaymentEvent({ eventId: event.eventId, type: event.providerType, now: new Date() });
  if (claim.outcome !== "claimed") {
    // `duplicate`: ya se procesó, 200 no-op. `in_flight`: otra entrega lo
    // está procesando ahora mismo — esa entrega responde por sí sola.
    return;
  }

  try {
    const outcome = await dispatchPaymentEvent(event, provider);
    if (outcome.status === "rejected") {
      await failPaymentEvent({
        eventId: event.eventId,
        lockedAt: claim.lockedAt,
        error: outcome.reason,
        ...(outcome.orderId ? { orderId: outcome.orderId } : {}),
      });
      return;
    }
    await completePaymentEvent({
      eventId: event.eventId,
      lockedAt: claim.lockedAt,
      status: outcome.status,
      ...(outcome.status === "processed" && outcome.orderId ? { orderId: outcome.orderId } : {}),
    });
  } catch (error) {
    logger.error({ eventId: event.eventId, type: event.providerType, err: error }, "Fallo al procesar un evento de pago");
    await failPaymentEvent({ eventId: event.eventId, lockedAt: claim.lockedAt, error: describeError(error) });
    // Relanza un error GENÉRICO a propósito, nunca el original: un handler
    // puede lanzar un `AppError` con su propio `statusCode` (409 de
    // `closePendingOrder` si una carrera de eventos deja la orden en un
    // estado inesperado, 502/503 del adapter de Stripe) — dejarlo escapar
    // tal cual haría que el controller respondiera ESE código en vez de
    // 500, rompiendo el contrato de esta función (500 siempre en fallo
    // transitorio, para que Stripe reintente — decisión 7 del plan de
    // 1.6.2). El error real ya quedó logueado y en `PaymentEvent.error`.
    throw new Error(`Fallo al procesar el evento de pago ${event.eventId}.`);
  }
}

export { processPaymentWebhook };
