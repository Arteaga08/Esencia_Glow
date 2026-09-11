import type Stripe from "stripe";
import { AppError } from "../utils/app-error.js";
import { PaymentMethod } from "@esencia-glow/shared";
import { parseStripeWebhookEvent } from "./stripe-webhook-translator.js";
import type {
  AuthorizePaymentInput,
  CancelOutcome,
  PaymentAuthorization,
  PaymentAuthorizationStatus,
  PaymentProvider,
  PaymentWebhookEvent,
} from "./payment-provider.js";

/**
 * Único archivo (junto a payment-provider.ts y stripe-webhook-translator.ts)
 * donde puede aparecer vocabulario crudo de Stripe. Traduce PaymentIntent ->
 * `PaymentAuthorization` en nuestro vocabulario, en centavos enteros, con
 * `PaymentState` propio.
 *
 * Interfaz estructural angosta del cliente de Stripe que este adapter
 * necesita — permite testear el mapeo con un cliente falso sin depender del
 * tipo completo del SDK (que el cliente real satisface sin cast).
 */
interface StripeClientLike {
  paymentIntents: {
    create: Stripe["paymentIntents"]["create"];
    retrieve: Stripe["paymentIntents"]["retrieve"];
    cancel: Stripe["paymentIntents"]["cancel"];
  };
}

/** Configuración del webhook — opcional porque en dev sin `STRIPE_WEBHOOK_SECRET`
 * el provider real de checkout/reconciliación sigue funcionando; solo
 * `parseWebhookEvent` responde 503 (ver resolvePaymentProvider). */
interface StripeWebhookConfig {
  secret?: string;
  toleranceSeconds: number;
}

interface StripeErrorLike {
  type?: string;
  code?: string;
  message?: string;
  payment_intent?: { status?: string };
}

function isStripeErrorLike(error: unknown): error is StripeErrorLike {
  return typeof error === "object" && error !== null && "type" in error;
}

/** Traduce un fallo de la llamada de creación/cancelación al vocabulario de
 * AppError: una reentrega de idempotencia con payload distinto es un
 * conflicto de negocio (409); cualquier otro fallo de Stripe (red, monto
 * inválido, API caída) es un fallo del tercero (502) — nunca un 500 críptico. */
function translateStripeError(error: unknown): never {
  if (isStripeErrorLike(error) && error.type === "StripeIdempotencyError") {
    throw new AppError("Esa operación ya se procesó con datos distintos, intenta de nuevo.", 409);
  }
  throw new AppError("No pudimos comunicarnos con el procesador de pagos.", 502);
}

function mapPaymentIntentStatus(status: Stripe.PaymentIntent.Status): PaymentAuthorizationStatus {
  switch (status) {
    case "succeeded":
      return "captured";
    case "requires_action":
      return "awaiting_customer";
    case "processing":
      return "processing";
    case "canceled":
      return "canceled";
    case "requires_payment_method":
    default:
      return "requires_new_method";
  }
}

/**
 * `PaymentIntent.latest_charge` es `string | Charge | null` — solo trae el
 * objeto expandido si la llamada pidió `expand: ["latest_charge"]`
 * (ver getAuthorization). Sin expandir, llega como id: no hay tarjeta que
 * leer todavía en ese caso (nunca se lee antes de capturar — frontera
 * PCI SAQ-A, igual que documenta payment-provider.ts).
 */
function extractCard(pi: Stripe.PaymentIntent): { brand: string; last4: string } | undefined {
  const latestCharge = pi.latest_charge;
  if (!latestCharge || typeof latestCharge === "string") return undefined;
  const card = latestCharge.payment_method_details?.card;
  if (!card?.brand || !card.last4) return undefined;
  return { brand: card.brand, last4: card.last4 };
}

function extractVoucher(pi: Stripe.PaymentIntent): { expiresAt: Date; hostedVoucherUrl: string } | undefined {
  const details = (
    pi.next_action as unknown as {
      oxxo_display_details?: { expires_after: number; hosted_voucher_url: string };
    }
  )?.oxxo_display_details;
  if (!details) return undefined;
  return { expiresAt: new Date(details.expires_after * 1000), hostedVoucherUrl: details.hosted_voucher_url };
}

function toPaymentAuthorization(pi: Stripe.PaymentIntent, clientSecret?: string): PaymentAuthorization {
  return {
    intentId: pi.id,
    status: mapPaymentIntentStatus(pi.status),
    amountCents: pi.amount,
    currency: pi.currency,
    ...(clientSecret ? { clientSecret } : {}),
    ...(extractCard(pi) ? { card: extractCard(pi) } : {}),
    ...(extractVoucher(pi) ? { voucher: extractVoucher(pi) } : {}),
    ...(pi.last_payment_error?.message ? { lastError: pi.last_payment_error.message } : {}),
  };
}

function buildShippingParam(input: AuthorizePaymentInput): Stripe.PaymentIntentCreateParams.Shipping {
  return { name: input.shipping.name, address: input.shipping.address };
}

/**
 * Tarjeta: el PI se crea SIN confirmar — el Payment Element del navegador lo
 * confirma (SAQ-A: la API nunca ve el número de tarjeta). `request_three_d_secure:
 * "automatic"` explícito (decisión 8 del plan de 1.6: sin política
 * configurable en Settings, a diferencia de otros proyectos con tickets
 * altos) — Stripe pide el reto solo cuando el banco/Radar lo requieren.
 */
async function authorizeCard(
  client: StripeClientLike,
  input: AuthorizePaymentInput,
): Promise<PaymentAuthorization> {
  const pi = await client.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency,
      payment_method_types: ["card"],
      payment_method_options: { card: { request_three_d_secure: "automatic" } },
      receipt_email: input.customer.email,
      shipping: buildShippingParam(input),
      metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
    },
    { idempotencyKey: input.idempotencyKey },
  );
  // "requires_payment_method" es ambiguo en el vocabulario crudo de
  // Stripe: es el estado normal de un PI de tarjeta recién creado SIN
  // confirmar (esperando que el Payment Element lo confirme) Y TAMBIÉN el
  // estado tras un rechazo. Aquí solo puede ser el primero (acabamos de
  // crearlo), así que se fuerza "awaiting_customer" en vez de usar el mapeo
  // genérico (que sirve para getAuthorization/reconciliación, donde SÍ debe
  // leerse como "necesita otro método").
  const authorization = toPaymentAuthorization(pi, pi.client_secret ?? undefined);
  return pi.status === "requires_payment_method"
    ? { ...authorization, status: "awaiting_customer" }
    : authorization;
}

/**
 * OXXO: el servidor crea Y CONFIRMA el PI (no hay widget de cliente para
 * OXXO) — así conoce al instante `expires_after` y la URL de la ficha, y
 * nunca existe un pedido OXXO sin ficha emitida.
 */
async function authorizeOxxo(
  client: StripeClientLike,
  input: AuthorizePaymentInput,
): Promise<PaymentAuthorization> {
  if (!input.oxxoVoucherDays) {
    throw new AppError("Falta el plazo de la ficha OXXO.", 500);
  }
  const pi = await client.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency,
      payment_method_types: ["oxxo"],
      payment_method_data: {
        type: "oxxo",
        billing_details: { name: input.customer.name, email: input.customer.email },
      },
      payment_method_options: { oxxo: { expires_after_days: input.oxxoVoucherDays } },
      confirm: true,
      shipping: buildShippingParam(input),
      metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return toPaymentAuthorization(pi);
}

const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

function createStripePaymentProvider(
  client: StripeClientLike,
  webhook: StripeWebhookConfig = { toleranceSeconds: DEFAULT_WEBHOOK_TOLERANCE_SECONDS },
): PaymentProvider {
  return {
    async authorize(input: AuthorizePaymentInput): Promise<PaymentAuthorization> {
      try {
        return input.method === PaymentMethod.OXXO
          ? await authorizeOxxo(client, input)
          : await authorizeCard(client, input);
      } catch (error) {
        translateStripeError(error);
      }
    },

    async getAuthorization(intentId: string): Promise<PaymentAuthorization> {
      try {
        // `expand: ["latest_charge"]` es la única forma de leer la tarjeta
        // (brand/last4): sin expandir, `latest_charge` llega como id crudo.
        const pi = await client.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
        return toPaymentAuthorization(pi);
      } catch (error) {
        translateStripeError(error);
      }
    },

    async cancel(intentId: string, idempotencyKey: string): Promise<CancelOutcome> {
      try {
        await client.paymentIntents.cancel(intentId, {}, { idempotencyKey });
        return "canceled";
      } catch (error) {
        if (
          isStripeErrorLike(error) &&
          error.type === "StripeInvalidRequestError" &&
          error.code === "payment_intent_unexpected_state"
        ) {
          const piStatus = error.payment_intent?.status;
          // Cancelar un PI que YA está cancelado es un resultado exitoso e
          // idempotente (dos reentregas del webhook, o el reconciliador y el
          // webhook compitiendo) — nunca un "no se puede cancelar".
          if (piStatus === "canceled") return "canceled";
          return piStatus === "succeeded" ? "already_captured" : "not_cancelable";
        }
        translateStripeError(error);
      }
    },

    parseWebhookEvent(rawBody: Buffer, signature: string): PaymentWebhookEvent {
      if (!webhook.secret) {
        throw new AppError("Los webhooks de pago no están configurados.", 503);
      }
      return parseStripeWebhookEvent(rawBody, signature, { secret: webhook.secret, toleranceSeconds: webhook.toleranceSeconds });
    },
  };
}

export { createStripePaymentProvider };
export type { StripeClientLike, StripeWebhookConfig };
