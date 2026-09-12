import Stripe from "stripe";
import { DisputeStatus } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import type { PaymentWebhookEvent } from "./payment-provider.js";

/**
 * Traduce un webhook crudo de Stripe a `PaymentWebhookEvent` (vocabulario
 * propio, §A del plan de 1.6.2). Único archivo (junto a
 * stripe-payment-provider.ts) donde puede aparecer vocabulario crudo de
 * Stripe: `event.type`, `payment_intent.*`, `metadata` — nada de esto debe
 * escapar de aquí.
 */

interface ParseStripeWebhookEventOptions {
  secret: string;
  /** Segundos de tolerancia del timestamp del header — anti-replay. Nunca 0
   * (ver config/env.ts, que ya lo valida al arranque). */
  toleranceSeconds: number;
}

const PAYMENT_INTENT_EVENT_TYPES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
]);

/** `charge.refund.updated` solo nos importa cuando el reembolso FALLÓ — un
 * reembolso en curso (`pending`/`requires_action`) o que ya tuvo éxito
 * (`succeeded`, cubierto por `charge.refunded`) no dispara nada aquí. */
const FAILED_REFUND_STATUSES = new Set(["failed", "canceled"]);

function extractOrderIdHint(pi: Stripe.PaymentIntent): string | undefined {
  const value = pi.metadata?.orderId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** `payment_intent` en `Charge`/`Refund`/`Dispute` es `string | PaymentIntent | null`
 * — solo trae el objeto expandido si la llamada lo pidió explícitamente
 * (nunca el caso de un webhook). `null` (cargo sin PI, teóricamente
 * imposible en este proyecto, que no vende nada fuera de PaymentIntents)
 * se traduce a `ignored`: sin intent no hay forma de localizar la orden. */
function extractIntentId(paymentIntent: string | Stripe.PaymentIntent | null): string | undefined {
  if (!paymentIntent) return undefined;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

/**
 * Vocabulario del DOMINIO para el estado de una disputa (decisión 5 del
 * plan de 1.6.3) — traduce el `status` crudo de Stripe sin importar si vino
 * de `charge.dispute.created` o `.closed`: Stripe puede crear una disputa
 * que ya nace resuelta (categorías de alto riesgo), así que la traducción
 * depende del VALOR, no del tipo de evento que la trajo.
 */
function mapDisputeStatus(status: Stripe.Dispute.Status): DisputeStatus | undefined {
  switch (status) {
    case "needs_response":
    case "under_review":
    case "warning_needs_response":
    case "warning_under_review":
      return DisputeStatus.OPEN;
    case "won":
      return DisputeStatus.WON;
    case "lost":
      return DisputeStatus.LOST;
    // `charge_refunded` (cierra sin veredicto ganado/perdido, porque el
    // comercio reembolsó el cargo directamente) no aparece en el union
    // type de la SDK — llega como `OtherString` — pero sigue siendo un
    // valor real y documentado de la API de Stripe.
    case "warning_closed":
    case "prevented":
    case "charge_refunded":
      return DisputeStatus.WITHDRAWN;
    default:
      return undefined;
  }
}

function translatePaymentIntentEvent(
  providerType: string,
  eventId: string,
  pi: Stripe.PaymentIntent,
): PaymentWebhookEvent {
  const orderIdHint = extractOrderIdHint(pi);
  switch (providerType) {
    case "payment_intent.succeeded":
      return { kind: "payment.captured", eventId, providerType, intentId: pi.id, ...(orderIdHint ? { orderIdHint } : {}) };
    case "payment_intent.payment_failed":
      return {
        kind: "payment.failed",
        eventId,
        providerType,
        intentId: pi.id,
        ...(orderIdHint ? { orderIdHint } : {}),
        ...(pi.last_payment_error?.message ? { lastError: pi.last_payment_error.message } : {}),
      };
    case "payment_intent.canceled":
      return { kind: "payment.canceled", eventId, providerType, intentId: pi.id, ...(orderIdHint ? { orderIdHint } : {}) };
    default:
      return { kind: "ignored", eventId, providerType };
  }
}

function translateChargeRefundedEvent(providerType: string, eventId: string, charge: Stripe.Charge): PaymentWebhookEvent {
  const intentId = extractIntentId(charge.payment_intent);
  if (!intentId) return { kind: "ignored", eventId, providerType };
  return {
    kind: "payment.refunded",
    eventId,
    providerType,
    intentId,
    amountRefundedCents: charge.amount_refunded,
    currency: charge.currency,
  };
}

/** `metadata.refundRequestedAtMs` viaja de vuelta desde
 * `stripe-payment-provider.ts` (solo si el reembolso lo pidió nuestro
 * endpoint) — ausente para un reembolso hecho a mano desde el Dashboard. */
function extractRequestedAtMs(refund: Stripe.Refund): number | undefined {
  const raw = refund.metadata?.refundRequestedAtMs;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function translateRefundUpdatedEvent(providerType: string, eventId: string, refund: Stripe.Refund): PaymentWebhookEvent {
  const intentId = extractIntentId(refund.payment_intent);
  if (!intentId || !FAILED_REFUND_STATUSES.has(refund.status ?? "")) {
    return { kind: "ignored", eventId, providerType };
  }
  const requestedAtMs = extractRequestedAtMs(refund);
  return {
    kind: "refund.failed",
    eventId,
    providerType,
    intentId,
    refundId: refund.id,
    ...(refund.failure_reason ? { reason: refund.failure_reason } : {}),
    ...(requestedAtMs !== undefined ? { requestedAtMs } : {}),
  };
}

function translateDisputeEvent(providerType: string, eventId: string, dispute: Stripe.Dispute): PaymentWebhookEvent {
  const intentId = extractIntentId(dispute.payment_intent);
  if (!intentId) return { kind: "ignored", eventId, providerType };

  const outcome = mapDisputeStatus(dispute.status);
  if (!outcome) {
    logger.warn({ eventId, providerType, status: dispute.status }, "Estado de disputa de Stripe sin traducción conocida");
    return { kind: "ignored", eventId, providerType };
  }
  if (outcome === DisputeStatus.OPEN) {
    return { kind: "dispute.opened", eventId, providerType, intentId, disputeId: dispute.id };
  }
  return { kind: "dispute.closed", eventId, providerType, intentId, disputeId: dispute.id, outcome };
}

/** `event.type` decide qué forma tiene `event.data.object` y a qué
 * traductor especializado delegar; el resto de campos se lee de ese mismo
 * objeto (ver cada `translate*Event` arriba). Cualquier tipo no cubierto
 * aquí llega `ignored` — el endpoint solo se suscribe a los 7 tipos de la
 * tabla del README. */
function translateStripeEvent(event: Stripe.Event): PaymentWebhookEvent {
  const eventId = event.id;
  const providerType = event.type;

  if (PAYMENT_INTENT_EVENT_TYPES.has(providerType)) {
    return translatePaymentIntentEvent(providerType, eventId, event.data.object as Stripe.PaymentIntent);
  }
  if (providerType === "charge.refunded") {
    return translateChargeRefundedEvent(providerType, eventId, event.data.object as Stripe.Charge);
  }
  if (providerType === "charge.refund.updated") {
    return translateRefundUpdatedEvent(providerType, eventId, event.data.object as Stripe.Refund);
  }
  if (providerType === "charge.dispute.created" || providerType === "charge.dispute.closed") {
    return translateDisputeEvent(providerType, eventId, event.data.object as Stripe.Dispute);
  }
  return { kind: "ignored", eventId, providerType };
}

/**
 * Verifica la firma HMAC (`stripe-signature`) sobre el Buffer crudo y la
 * tolerancia de timestamp — nunca confiar en el payload si esto falla (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Pagos con proveedor externo").
 * Firma inválida, secreto distinto o timestamp fuera de tolerancia → 400,
 * sin distinguir el motivo exacto (no darle a un atacante información de
 * por qué falló).
 */
function parseStripeWebhookEvent(
  rawBody: Buffer,
  signature: string,
  options: ParseStripeWebhookEventOptions,
): PaymentWebhookEvent {
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, signature, options.secret, options.toleranceSeconds);
  } catch {
    throw new AppError("Firma de webhook inválida.", 400);
  }
  return translateStripeEvent(event);
}

export { parseStripeWebhookEvent, translateStripeEvent };
