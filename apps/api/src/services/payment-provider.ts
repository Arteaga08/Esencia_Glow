import type { DisputeStatus, PaymentMethod } from "@esencia-glow/shared";
import { env } from "../config/env.js";
import { isStripeConfigured, getStripeClient } from "../config/stripe.js";
import { createStripePaymentProvider } from "./stripe-payment-provider.js";

/**
 * Interfaz angosta del proveedor de pagos — mismo patrón que
 * media-provider.ts/shipping-provider.ts. Vocabulario propio del dominio:
 * nada llamado `payment_intent`/`client_secret`/`whsec_` escapa de este
 * archivo ni de stripe-payment-provider.ts (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"El adapter habla nuestro
 * vocabulario"). Sin `capture`: este proyecto no tiene captura manual.
 */
interface PaymentCustomerInput {
  email: string;
  name: string;
}

interface PaymentShippingAddressInput {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface PaymentShippingInput {
  name: string;
  address: PaymentShippingAddressInput;
}

interface AuthorizePaymentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  customer: PaymentCustomerInput;
  shipping: PaymentShippingInput;
  /** Requerido solo para `method: "oxxo"`. */
  oxxoVoucherDays?: number;
  idempotencyKey: string;
}

type PaymentAuthorizationStatus =
  | "awaiting_customer"
  | "processing"
  | "captured"
  | "requires_new_method"
  | "canceled";

interface PaymentAuthorization {
  intentId: string;
  status: PaymentAuthorizationStatus;
  amountCents: number;
  currency: string;
  /** Solo tarjeta, mientras el pago no se ha confirmado. */
  clientSecret?: string;
  /** Solo tarjeta, y solo una vez que Stripe ya tiene un cargo del cual
   * leerlo (nunca antes de capturar — frontera PCI SAQ-A). */
  card?: { brand: string; last4: string };
  /** Solo OXXO. */
  voucher?: { expiresAt: Date; hostedVoucherUrl: string };
  lastError?: string;
}

type CancelOutcome = "canceled" | "already_captured" | "not_cancelable";

interface RefundPaymentInput {
  orderId: string;
  intentId: string;
  amountCents: number;
  idempotencyKey: string;
  /** `payment.refundRequestedAt.getTime()` del mutex que reclamó esta
   * solicitud (ver order-refund.service.ts) — viaja como metadata hacia
   * Stripe para que un `charge.refund.updated` (`refund.failed`) tardío
   * pueda liberar EXACTAMENTE ese mutex y no uno más reciente de un
   * reintento posterior (fencing por valor, igual que el resto del
   * módulo de reembolsos). */
  requestedAtMs: number;
}

type RefundOutcome = "pending" | "succeeded" | "failed";

interface RefundResult {
  refundId: string;
  status: RefundOutcome;
}

/**
 * Evento de dominio traducido de un webhook de pago (Milestone 1.6.2, +
 * reembolsos/disputas en 1.6.3). El `eventId`/`providerType` crudo del
 * proveedor viaja para dedupe y logging, pero el resto del sistema despacha
 * sobre `kind`, nunca sobre el tipo de evento de Stripe (ver
 * stripe-webhook-translator.ts).
 *
 * `payment.refunded`/`refund.failed`/`dispute.*` NO llevan `orderIdHint`:
 * a diferencia de `payment.captured` (que puede llegar antes de que
 * `persistPaymentIntent` alcance a guardar el `intentId`), un reembolso o
 * una disputa solo existen sobre un pago YA capturado — para ese momento
 * `payment.intentId` ya está en la orden, así que localizar solo por
 * intent basta (ver payment-post-capture-handlers.ts).
 */
type PaymentWebhookEvent =
  | { kind: "payment.captured"; eventId: string; providerType: string; intentId: string; orderIdHint?: string }
  | {
      kind: "payment.failed";
      eventId: string;
      providerType: string;
      intentId: string;
      orderIdHint?: string;
      lastError?: string;
    }
  | { kind: "payment.canceled"; eventId: string; providerType: string; intentId: string; orderIdHint?: string }
  | {
      kind: "payment.refunded";
      eventId: string;
      providerType: string;
      intentId: string;
      amountRefundedCents: number;
      currency: string;
    }
  | {
      kind: "refund.failed";
      eventId: string;
      providerType: string;
      intentId: string;
      refundId: string;
      reason?: string;
      /** `RefundPaymentInput.requestedAtMs` de vuelta, leído de
       * `Refund.metadata` — presente solo si el reembolso se originó por
       * nuestro endpoint (uno hecho a mano desde el Dashboard no lo trae).
       * `recordRefundFailure` lo usa para el fencing del `$unset`. */
      requestedAtMs?: number;
    }
  | { kind: "dispute.opened"; eventId: string; providerType: string; intentId: string; disputeId: string }
  | {
      kind: "dispute.closed";
      eventId: string;
      providerType: string;
      intentId: string;
      disputeId: string;
      outcome: DisputeStatus;
    }
  | { kind: "ignored"; eventId: string; providerType: string };

interface PaymentProvider {
  authorize(input: AuthorizePaymentInput): Promise<PaymentAuthorization>;
  getAuthorization(intentId: string): Promise<PaymentAuthorization>;
  cancel(intentId: string, idempotencyKey: string): Promise<CancelOutcome>;
  /** Reembolso TOTAL (§E del plan de 1.6): el monto lo decide el caller
   * (el remanente `totalCents - refundedAmountCents`), nunca un parcial
   * iniciado desde nuestra API. */
  refund(input: RefundPaymentInput): Promise<RefundResult>;
  /** Lanza 503 si el webhook no está configurado (sin `STRIPE_WEBHOOK_SECRET`),
   * 400 si la firma/timestamp no verifican (ver stripe-webhook-translator.ts). */
  parseWebhookEvent(rawBody: Buffer, signature: string): PaymentWebhookEvent;
}

/**
 * Seam de pruebas: en `NODE_ENV=test` (nunca en dev/producción), un
 * proveedor falso inyectado explícitamente tiene prioridad sobre la
 * resolución real — así los tests de rutas (supertest contra `buildApp()`)
 * ejercitan el checkout completo (incluida la creación del PaymentIntent)
 * sin llaves reales de Stripe. `"unset"` distingue "nunca se llamó" de
 * "se llamó con `undefined`" (para probar el 503 explícitamente).
 */
let testOverride: PaymentProvider | undefined | "unset" = "unset";

function __setPaymentProviderForTests(provider: PaymentProvider | undefined): void {
  if (!env.isTest) {
    throw new Error("__setPaymentProviderForTests solo puede usarse en NODE_ENV=test");
  }
  testOverride = provider;
}

/** Único condicional de proveedor de todo el proyecto — mismo patrón que
 * `resolveMediaProvider()`/`resolveShippingProvider()`. */
function resolvePaymentProvider(): PaymentProvider | undefined {
  if (env.isTest && testOverride !== "unset") return testOverride;
  if (!isStripeConfigured()) return undefined;
  const client = getStripeClient();
  if (!client) return undefined;
  return createStripePaymentProvider(client, {
    secret: env.stripeWebhookSecret,
    toleranceSeconds: env.stripeWebhookToleranceSeconds,
  });
}

export { resolvePaymentProvider, __setPaymentProviderForTests };
export type {
  PaymentProvider,
  AuthorizePaymentInput,
  PaymentAuthorization,
  PaymentAuthorizationStatus,
  CancelOutcome,
  RefundPaymentInput,
  RefundOutcome,
  RefundResult,
  PaymentCustomerInput,
  PaymentShippingInput,
  PaymentShippingAddressInput,
  PaymentWebhookEvent,
};
