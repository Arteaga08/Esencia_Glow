import { env } from "../config/env.js";
import { isStripeConfigured, getStripeClient } from "../config/stripe.js";
import { createStripeSubscriptionProvider } from "./stripe-subscription-provider.js";

/**
 * Puerto de Stripe Billing (Milestone 1.7.2a) — HERMANO de `PaymentProvider`
 * (payment-provider.ts), no una extensión: `__setPaymentProviderForTests(undefined)`
 * se usa para probar el 503 del webhook de pagos y apagaría también Billing
 * si compartieran el mismo seam; y el fake de pagos crecería con métodos que
 * el 90% de los tests de checkout nunca llama. Única excepción: el webhook
 * (`parseWebhookEvent`) sigue en `PaymentProvider` — hay un solo endpoint,
 * un solo `STRIPE_WEBHOOK_SECRET`, y el controller no puede saber a qué
 * dominio pertenece el evento antes de verificar la firma.
 *
 * Vocabulario propio del dominio: nada llamado `price_id`/`product_id`
 * crudo debe escapar de este archivo ni de stripe-subscription-provider.ts.
 *
 * `createPlanProduct` sincroniza el plan con Stripe al crearlo (Fase 1).
 * `ensureCustomer`/`startSubscription`/`getSubscription` (Fase 4) cubren el
 * alta: `ensureCustomer` es idempotente por `idempotencyKey` (una re-alta
 * reusa el mismo Customer si `SubscriptionAccount.providerCustomerId` ya
 * existe, nunca crea un segundo); `getSubscription` es la rama replay del
 * endpoint (`ensurePaymentIntent` es el precedente exacto).
 */
interface CreatePlanProductInput {
  /** `slug` del plan, no el `_id` de Mongo: útil como referencia legible en
   * el Dashboard de Stripe y en `metadata`. */
  planSlug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  idempotencyKey: string;
}

interface PlanProductRefs {
  productRef: string;
  priceRef: string;
}

/** Estado del proveedor, YA traducido — el vocabulario crudo de Stripe
 * (`incomplete_expired`, `unpaid`, `trialing`) nunca sale del adapter ni del
 * traductor de webhooks (ver stripe-subscription-webhook-translator.ts). */
type ProviderSubscriptionStatus = "incomplete" | "active" | "past_due" | "paused" | "canceled";

interface EnsureCustomerInput {
  email: string;
  name: string;
  idempotencyKey: string;
}

/**
 * Alta sobre Billing (Fase 4 de 1.7.2a, §E del plan): `priceRef` viene del
 * plan (`SubscriptionPlan.providerPriceId`), nunca un monto — el servidor no
 * manda montos a Stripe, el Price ya los tiene. `billingAnchorDay` viaja
 * suelto (no como Date) porque `billing_cycle_anchor_config` de Stripe pide
 * el día del mes, no un timestamp — ver stripe-subscription-provider.ts.
 */
interface StartProviderSubscriptionInput {
  customerRef: string;
  priceRef: string;
  billingAnchorDay: number;
  metadata: { accountId: string; userId: string; planId: string };
  idempotencyKey: string;
}

/**
 * Snapshot YA traducido de una suscripción de Billing — lo que el endpoint
 * de alta necesita para el DTO de la clienta (`clientSecret`,
 * `firstChargeCents`, `currency`, `nextChargeAt`) y lo que el orquestador
 * necesita para persistir el período. Campos opcionales porque
 * `getSubscription` (rama replay) puede verla en un momento donde algunos ya
 * no aplican (p. ej. `clientSecret` de una factura ya pagada).
 */
interface ProviderSubscription {
  subscriptionRef: string;
  status: ProviderSubscriptionStatus;
  clientSecret?: string;
  firstChargeCents?: number;
  currency?: string;
  nextChargeAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  /** `pause_collection` activa (1.7.3). Pausar la cobranza NO cambia el
   * `status` del proveedor (sigue `active`), así que esta es la única señal. */
  collectionPaused: boolean;
  cancelAtPeriodEnd: boolean;
  /** Precio vigente del ítem — confirma que un cambio de plan ya aplicó. */
  priceRef?: string;
}

interface PauseCollectionInput {
  subscriptionRef: string;
}

interface SetCancelAtPeriodEndInput {
  subscriptionRef: string;
  cancelAtPeriodEnd: boolean;
  /** Motivo escrito por la clienta (`cancelReason`); solo al marcar. */
  comment?: string;
}

interface CancelNowInput {
  subscriptionRef: string;
  comment?: string;
  idempotencyKey: string;
}

/** Cambio de precio SIN prorrateo y con el ancla intacta (decisión de 1.7.3):
 * el siguiente cobro anclado ya usa el precio nuevo. */
interface ChangePriceInput {
  subscriptionRef: string;
  priceRef: string;
  metadata: { planId: string };
  idempotencyKey: string;
}

interface PaymentMethodSetupInput {
  customerRef: string;
  accountId: string;
}

/** Lo que el front necesita para confirmar la tarjeta en sesión. */
interface PaymentMethodSetup {
  clientSecret: string;
}

type PaymentMethodSetupStatus = "succeeded" | "pending" | "failed";

/** Estado ya traducido de un intento de guardar tarjeta. `customerRef` y
 * `accountIdHint` sirven para verificar la PROPIEDAD del intento — el
 * `setupIntentId` lo manda el cliente, nunca se confía en él a ciegas. */
interface PaymentMethodSetupState {
  status: PaymentMethodSetupStatus;
  customerRef?: string;
  paymentMethodRef?: string;
  accountIdHint?: string;
}

interface SetDefaultPaymentMethodInput {
  subscriptionRef: string;
  customerRef: string;
  paymentMethodRef: string;
}

interface RetryInvoicePaymentInput {
  invoiceRef: string;
  paymentMethodRef: string;
  idempotencyKey: string;
}

/** Un rechazo o una autenticación pendiente son desenlaces de NEGOCIO, no
 * excepciones: el endpoint responde con ellos, no con un 5xx. */
type InvoiceRetryOutcome = "paid" | "already_settled" | "requires_action" | "declined";

interface InvoiceRetryResult {
  outcome: InvoiceRetryOutcome;
}

/**
 * Evento de dominio traducido de un webhook de Billing (Milestone 1.7.2a) —
 * unión HERMANA de `PaymentWebhookEvent` (payment-provider.ts), sin
 * `ignored` propio: eso lo sigue devolviendo el traductor central
 * (stripe-webhook-translator.ts) cuando ningún traductor especializado
 * reconoce el evento.
 *
 * Alta y renovación producen el MISMO `kind` (`subscription.invoice_paid`) a
 * propósito: la diferencia (primer cobro vs. recurrente) se deriva del
 * estado de la cuenta en NUESTRA base al procesar el evento, nunca del
 * evento mismo — es la única fuente correcta cuando Stripe reentrega fuera
 * de orden. `billingReason` viaja solo para filtrar facturas manuales
 * (`"other"`) y para copy de correo.
 */
type SubscriptionWebhookEvent =
  | {
      kind: "subscription.invoice_paid";
      eventId: string;
      providerType: string;
      subscriptionRef: string;
      invoiceRef: string;
      accountIdHint?: string;
      amountPaidCents: number;
      currency: string;
      servicePeriodStart: Date;
      servicePeriodEnd: Date;
      billingReason: "subscription_create" | "subscription_cycle" | "other";
    }
  | {
      kind: "subscription.payment_failed";
      eventId: string;
      providerType: string;
      subscriptionRef: string;
      invoiceRef: string;
      accountIdHint?: string;
      attemptCount: number;
      nextAttemptAt?: Date;
    }
  | {
      kind: "subscription.updated";
      eventId: string;
      providerType: string;
      subscriptionRef: string;
      accountIdHint?: string;
      status: ProviderSubscriptionStatus;
      cancelAtPeriodEnd: boolean;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      /** Solo cuando `status` es `canceled`: hora REAL de término
       * (`ended_at`, con `canceled_at` como respaldo). Sin esto el handler
       * sellaba la hora del servidor (deferido de 1.7.2a, cerrado en 1.7.3). */
      canceledAt?: Date;
      reason?: string;
      /** `pause_collection` activa en el proveedor. El `status` NO cambia al
       * pausar la cobranza (sigue `active`), así que es la única señal. */
      collectionPaused: boolean;
    }
  | {
      kind: "subscription.canceled";
      eventId: string;
      providerType: string;
      subscriptionRef: string;
      accountIdHint?: string;
      canceledAt: Date;
      reason?: string;
    };

interface SubscriptionProvider {
  createPlanProduct(input: CreatePlanProductInput): Promise<PlanProductRefs>;
  ensureCustomer(input: EnsureCustomerInput): Promise<string>;
  startSubscription(input: StartProviderSubscriptionInput): Promise<ProviderSubscription>;
  getSubscription(subscriptionRef: string): Promise<ProviderSubscription>;
  // --- autoservicio de la suscriptora (Milestone 1.7.3) ---
  pauseCollection(input: PauseCollectionInput): Promise<ProviderSubscription>;
  resumeCollection(input: PauseCollectionInput): Promise<ProviderSubscription>;
  setCancelAtPeriodEnd(input: SetCancelAtPeriodEndInput): Promise<ProviderSubscription>;
  cancelNow(input: CancelNowInput): Promise<ProviderSubscription>;
  changePrice(input: ChangePriceInput): Promise<ProviderSubscription>;
  createPaymentMethodSetup(input: PaymentMethodSetupInput): Promise<PaymentMethodSetup>;
  getPaymentMethodSetup(setupRef: string): Promise<PaymentMethodSetupState>;
  setDefaultPaymentMethod(input: SetDefaultPaymentMethodInput): Promise<void>;
  retryInvoicePayment(input: RetryInvoicePaymentInput): Promise<InvoiceRetryResult>;
}

/**
 * Seam de pruebas: mismo patrón `"unset"` que `payment-provider.ts` — en
 * `NODE_ENV=test`, un proveedor falso inyectado explícitamente tiene
 * prioridad sobre la resolución real, y `"unset"` distingue "nunca se
 * llamó" de "se llamó con `undefined`" (para probar el 503 explícitamente).
 */
let testOverride: SubscriptionProvider | undefined | "unset" = "unset";

function __setSubscriptionProviderForTests(provider: SubscriptionProvider | undefined): void {
  if (!env.isTest) {
    throw new Error("__setSubscriptionProviderForTests solo puede usarse en NODE_ENV=test");
  }
  testOverride = provider;
}

function resolveSubscriptionProvider(): SubscriptionProvider | undefined {
  if (env.isTest && testOverride !== "unset") return testOverride;
  if (!isStripeConfigured()) return undefined;
  const client = getStripeClient();
  if (!client) return undefined;
  return createStripeSubscriptionProvider(client);
}

export { resolveSubscriptionProvider, __setSubscriptionProviderForTests };
export type {
  SubscriptionProvider,
  CreatePlanProductInput,
  PlanProductRefs,
  ProviderSubscriptionStatus,
  SubscriptionWebhookEvent,
  EnsureCustomerInput,
  StartProviderSubscriptionInput,
  ProviderSubscription,
  PauseCollectionInput,
  SetCancelAtPeriodEndInput,
  CancelNowInput,
  ChangePriceInput,
  PaymentMethodSetupInput,
  PaymentMethodSetup,
  PaymentMethodSetupStatus,
  PaymentMethodSetupState,
  SetDefaultPaymentMethodInput,
  RetryInvoicePaymentInput,
  InvoiceRetryOutcome,
  InvoiceRetryResult,
};
