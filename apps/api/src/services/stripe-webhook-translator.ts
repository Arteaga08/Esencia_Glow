import Stripe from "stripe";
import { AppError } from "../utils/app-error.js";
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

function extractOrderIdHint(pi: Stripe.PaymentIntent): string | undefined {
  const value = pi.metadata?.orderId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * `event.type` decide el `kind`; el resto (`intentId`, `orderIdHint`,
 * `lastError`) se lee del mismo PaymentIntent para los tres tipos que nos
 * importan hasta 1.6.3 (`charge.refunded`/`dispute.*` quedan `ignored`
 * — decisión 9 del plan: no se suscriben en el endpoint de Stripe todavía).
 */
function translateStripeEvent(event: Stripe.Event): PaymentWebhookEvent {
  const eventId = event.id;
  const providerType = event.type;

  if (!PAYMENT_INTENT_EVENT_TYPES.has(providerType)) {
    return { kind: "ignored", eventId, providerType };
  }

  const pi = event.data.object as Stripe.PaymentIntent;
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
