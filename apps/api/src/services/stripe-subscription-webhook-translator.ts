import type Stripe from "stripe";
import { logger } from "../config/logger.js";
import type { ProviderSubscriptionStatus, SubscriptionWebhookEvent } from "./subscription-provider.js";

/**
 * Traduce los eventos de Stripe Billing a `SubscriptionWebhookEvent`
 * (Milestone 1.7.2a). Archivo separado de stripe-webhook-translator.ts (ya
 * en 205 líneas) — mismo precedente que payment-post-capture-handlers.ts
 * separado de payment-event-handlers.ts. Único archivo (junto a
 * subscription-provider.ts) donde puede aparecer vocabulario crudo de
 * Billing: `invoice.parent`, `subscription.items`, `confirmation_secret`.
 *
 * Cada `translate*` devuelve `undefined` cuando el evento no trae lo mínimo
 * para actuar (sin suscripción asociada) — el caller (`translateStripeEvent`
 * en stripe-webhook-translator.ts) cae en su `{kind:"ignored"}` compartido,
 * nunca se duplica ese caso aquí.
 */

/** El id de la suscripción y el snapshot de metadata viven en
 * `invoice.parent.subscription_details` desde la API `2026-08-26.dahlia` —
 * `invoice.subscription`/`invoice.payment_intent` de primer nivel ya no
 * existen (ver riesgo 1.7.2a §12). Una factura sin este campo es una
 * factura suelta (`quote_details` u otro origen), no de suscripción. */
function extractSubscriptionRef(invoice: Stripe.Invoice): string | undefined {
  const details = invoice.parent?.subscription_details;
  const sub = details?.subscription;
  if (!sub) return undefined;
  return typeof sub === "string" ? sub : sub.id;
}

function extractInvoiceAccountIdHint(invoice: Stripe.Invoice): string | undefined {
  const value = invoice.parent?.subscription_details?.metadata?.accountId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extractSubscriptionAccountIdHint(subscription: Stripe.Subscription): string | undefined {
  const value = subscription.metadata?.accountId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** El período de SERVICIO real es el de la línea, no `invoice.period_start`/
 * `period_end` (el propio docstring de Stripe dice que se use el de la
 * línea — ver riesgo 1.7.2a §12). Sin línea, no hay período que resolver. */
function extractServicePeriod(invoice: Stripe.Invoice): { start: Date; end: Date } | undefined {
  const period = invoice.lines?.data?.[0]?.period;
  if (!period) return undefined;
  return { start: new Date(period.start * 1000), end: new Date(period.end * 1000) };
}

function mapBillingReason(reason: string | null): "subscription_create" | "subscription_cycle" | "other" {
  if (reason === "subscription_create") return "subscription_create";
  if (reason === "subscription_cycle") return "subscription_cycle";
  return "other";
}

function translateInvoicePaidEvent(
  providerType: string,
  eventId: string,
  invoice: Stripe.Invoice,
): SubscriptionWebhookEvent | undefined {
  const subscriptionRef = extractSubscriptionRef(invoice);
  const period = extractServicePeriod(invoice);
  if (!subscriptionRef || !period) return undefined;

  const accountIdHint = extractInvoiceAccountIdHint(invoice);
  return {
    kind: "subscription.invoice_paid",
    eventId,
    providerType,
    subscriptionRef,
    invoiceRef: invoice.id ?? "",
    ...(accountIdHint ? { accountIdHint } : {}),
    amountPaidCents: invoice.amount_paid,
    currency: invoice.currency,
    servicePeriodStart: period.start,
    servicePeriodEnd: period.end,
    billingReason: mapBillingReason(invoice.billing_reason),
  };
}

function translateInvoicePaymentFailedEvent(
  providerType: string,
  eventId: string,
  invoice: Stripe.Invoice,
): SubscriptionWebhookEvent | undefined {
  const subscriptionRef = extractSubscriptionRef(invoice);
  if (!subscriptionRef) return undefined;

  const accountIdHint = extractInvoiceAccountIdHint(invoice);
  return {
    kind: "subscription.payment_failed",
    eventId,
    providerType,
    subscriptionRef,
    invoiceRef: invoice.id ?? "",
    ...(accountIdHint ? { accountIdHint } : {}),
    attemptCount: invoice.attempt_count,
    ...(invoice.next_payment_attempt ? { nextAttemptAt: new Date(invoice.next_payment_attempt * 1000) } : {}),
  };
}

/**
 * Vocabulario del DOMINIO para el estado de una suscripción — traduce por
 * VALOR, nunca deja escapar `incomplete_expired`/`unpaid`/`trialing`
 * crudos. `incomplete_expired`/`unpaid` -> `canceled` (decisión ya fijada en
 * el docstring de `SubscriptionStatus`, shared); desconocido -> `incomplete`
 * (interpretación cautelosa) + `logger.warn`, NUNCA lanza — un mapeo que
 * lanza convertiría un evento válido en un 500 con reintentos infinitos.
 *
 * `trialing -> active` es DELIBERADO y debe coincidir con el mismo case de
 * `stripe-subscription-provider.ts` (riesgo aceptado 🟡 #4 del plan de
 * 1.7.2a). Cuando faltaba aquí, `trialing` caía al `default` y una
 * suscripción puesta en trial desde el Dashboard producía un
 * `ACTIVE -> INCOMPLETE` inexistente que el webhook ignoraba en silencio:
 * dos traducciones del mismo valor con resultados opuestos según quién
 * preguntara (hallazgo de code review).
 */
function mapProviderSubscriptionStatus(status: Stripe.Subscription.Status): ProviderSubscriptionStatus {
  switch (status) {
    case "trialing":
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
    case "unpaid":
      return "canceled";
    case "incomplete":
      return "incomplete";
    default:
      logger.warn({ status }, "Estado de suscripción de Stripe sin traducción conocida");
      return "incomplete";
  }
}

function translateSubscriptionUpdatedEvent(
  providerType: string,
  eventId: string,
  subscription: Stripe.Subscription,
): SubscriptionWebhookEvent {
  const item = subscription.items?.data?.[0];
  const accountIdHint = extractSubscriptionAccountIdHint(subscription);

  return {
    kind: "subscription.updated",
    eventId,
    providerType,
    subscriptionRef: subscription.id,
    ...(accountIdHint ? { accountIdHint } : {}),
    status: mapProviderSubscriptionStatus(subscription.status),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    ...(item ? { currentPeriodStart: new Date(item.current_period_start * 1000) } : {}),
    ...(item ? { currentPeriodEnd: new Date(item.current_period_end * 1000) } : {}),
  };
}

function translateSubscriptionDeletedEvent(
  providerType: string,
  eventId: string,
  subscription: Stripe.Subscription,
): SubscriptionWebhookEvent {
  const accountIdHint = extractSubscriptionAccountIdHint(subscription);
  const reason = subscription.cancellation_details?.reason;

  return {
    kind: "subscription.canceled",
    eventId,
    providerType,
    subscriptionRef: subscription.id,
    ...(accountIdHint ? { accountIdHint } : {}),
    canceledAt: new Date((subscription.canceled_at ?? Math.floor(Date.now() / 1000)) * 1000),
    ...(reason ? { reason } : {}),
  };
}

/** Punto de entrada único, llamado desde `translateStripeEvent` justo antes
 * de su `{kind:"ignored"}` final. `invoice.payment_action_required` y
 * `customer.subscription.paused`/`.resumed` NO están suscritos a propósito
 * (ver README y riesgo 1.7.2a §B) — caen aquí como `undefined` por no
 * matchear ningún `Set`, y el caller los vuelve `ignored`. */
function translateStripeSubscriptionEvent(event: Stripe.Event): SubscriptionWebhookEvent | undefined {
  const eventId = event.id;
  const providerType = event.type;

  if (providerType === "invoice.paid") {
    return translateInvoicePaidEvent(providerType, eventId, event.data.object as Stripe.Invoice);
  }
  if (providerType === "invoice.payment_failed") {
    return translateInvoicePaymentFailedEvent(providerType, eventId, event.data.object as Stripe.Invoice);
  }
  if (providerType === "customer.subscription.updated") {
    return translateSubscriptionUpdatedEvent(providerType, eventId, event.data.object as Stripe.Subscription);
  }
  if (providerType === "customer.subscription.deleted") {
    return translateSubscriptionDeletedEvent(providerType, eventId, event.data.object as Stripe.Subscription);
  }
  return undefined;
}

export { translateStripeSubscriptionEvent };
