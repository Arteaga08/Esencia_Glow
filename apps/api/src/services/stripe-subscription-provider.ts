import type Stripe from "stripe";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";
import { translateStripeError } from "./stripe-payment-provider.js";
import type {
  CancelNowInput,
  ChangePriceInput,
  CreatePlanProductInput,
  EnsureCustomerInput,
  InvoiceRetryResult,
  PauseCollectionInput,
  PaymentMethodSetup,
  PaymentMethodSetupInput,
  PaymentMethodSetupState,
  PaymentMethodSetupStatus,
  PlanProductRefs,
  ProviderSubscription,
  ProviderSubscriptionStatus,
  RetryInvoicePaymentInput,
  SetCancelAtPeriodEndInput,
  SetDefaultPaymentMethodInput,
  StartProviderSubscriptionInput,
  SubscriptionProvider,
} from "./subscription-provider.js";

/**
 * Único archivo (junto a subscription-provider.ts) donde puede aparecer
 * vocabulario crudo de Stripe Billing. Interfaz estructural angosta del
 * cliente — mismo patrón que `StripeClientLike` en stripe-payment-provider.ts:
 * permite testear el mapeo con un cliente falso sin depender del tipo
 * completo del SDK.
 */
interface StripeBillingClientLike {
  products: {
    create: Stripe["products"]["create"];
  };
  prices: {
    create: Stripe["prices"]["create"];
  };
  customers: {
    create: Stripe["customers"]["create"];
    update: Stripe["customers"]["update"];
  };
  subscriptions: {
    create: Stripe["subscriptions"]["create"];
    retrieve: Stripe["subscriptions"]["retrieve"];
    update: Stripe["subscriptions"]["update"];
    cancel: Stripe["subscriptions"]["cancel"];
  };
  setupIntents: {
    create: Stripe["setupIntents"]["create"];
    retrieve: Stripe["setupIntents"]["retrieve"];
  };
  invoices: {
    retrieve: Stripe["invoices"]["retrieve"];
    pay: Stripe["invoices"]["pay"];
  };
}

/** Hora fija del ancla (Fase 4, §A del plan): 15:00 UTC ≈ 9:00 CDMX, para
 * que la fecha local y la UTC del cobro coincidan siempre (evita que un
 * ancla a medianoche UTC caiga en el día calendario ANTERIOR en México). */
const BILLING_ANCHOR_HOUR_UTC = 15;

/** `subscription.items.data[0].current_period_start/end` (hallazgo 1 del
 * plan): `Stripe.Subscription` ya NO tiene el período de primer nivel. */
function readCurrentPeriod(sub: Stripe.Subscription): { start?: Date; end?: Date } {
  const item = sub.items.data[0];
  if (!item) return {};
  return { start: new Date(item.current_period_start * 1000), end: new Date(item.current_period_end * 1000) };
}

/** `latest_invoice.confirmation_secret.client_secret` (hallazgo 3): solo
 * disponible cuando `latest_invoice` viaja expandido a objeto completo (ver
 * `expand: ["latest_invoice.confirmation_secret"]` en `startSubscription`/
 * `getSubscription`) — como string crudo (sin expandir) no hay nada que leer. */
function readClientSecret(sub: Stripe.Subscription): string | undefined {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return undefined;
  return invoice.confirmation_secret?.client_secret ?? undefined;
}

/** `latest_invoice.amount_due`/`currency` — el monto real del primer cobro
 * (precio completo del ciclo, decisión 4 del plan): nunca se calcula en
 * nuestro código, siempre se lee de la factura que Stripe ya finalizó. */
function readFirstCharge(sub: Stripe.Subscription): { amountCents?: number; currency?: string } {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return {};
  return { amountCents: invoice.amount_due, currency: invoice.currency };
}

/**
 * Vocabulario crudo de Stripe -> el nuestro (`ProviderSubscriptionStatus`).
 * `trialing -> active` es el riesgo aceptado 🟡 #4 del plan (solo alcanzable
 * por acción manual del admin en el Dashboard, nunca por nuestro código:
 * jamás mandamos `trial_period_days`). `incomplete_expired`/`unpaid ->
 * canceled`: son desenlaces terminales sin cobro, mismo efecto que cancelar.
 * Cualquier valor fuera del enum actual (futuro de la API) cae en
 * `incomplete` con un warning — nunca lanza desde un mapeo.
 */
function mapProviderSubscriptionStatus(status: Stripe.Subscription.Status): ProviderSubscriptionStatus {
  switch (status) {
    case "incomplete":
      return "incomplete";
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
    default:
      logger.warn({ status }, "Estado de Subscription de Stripe no reconocido, se trata como incomplete");
      return "incomplete";
  }
}

function toProviderSubscription(sub: Stripe.Subscription): ProviderSubscription {
  const period = readCurrentPeriod(sub);
  const firstCharge = readFirstCharge(sub);
  return {
    subscriptionRef: sub.id,
    status: mapProviderSubscriptionStatus(sub.status),
    clientSecret: readClientSecret(sub),
    firstChargeCents: firstCharge.amountCents,
    currency: firstCharge.currency,
    nextChargeAt: new Date(sub.billing_cycle_anchor * 1000),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    collectionPaused: Boolean(sub.pause_collection),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    priceRef: sub.items.data[0]?.price?.id,
  };
}

/** Códigos con los que `invoices.pay` falla porque el banco pide autenticar al
 * titular (SCA). No es un rechazo: la clienta puede completarlo. */
const AUTHENTICATION_REQUIRED_CODES = new Set(["authentication_required", "invoice_payment_intent_requires_action"]);

interface StripeErrorShape {
  type?: string;
  code?: string;
  message?: string;
}

function readErrorShape(error: unknown): StripeErrorShape {
  return typeof error === "object" && error !== null ? (error as StripeErrorShape) : {};
}

/**
 * Errores de una operación que muta una suscripción EXISTENTE. Una petición
 * inválida sobre ella (ya cancelada, no editable en ese estado) es un
 * conflicto de NEGOCIO (409) — nunca un 502, que le diría a la clienta que
 * "el procesador no responde" cuando el problema es el estado de su cuenta.
 * El mensaje crudo se loguea para que un parámetro mal armado por NOSOTROS
 * (que también llega como `invalid_request_error`) no quede oculto tras el 409.
 */
function translateSubscriptionMutationError(error: unknown): never {
  const shape = readErrorShape(error);
  if (shape.type === "StripeInvalidRequestError") {
    logger.warn({ code: shape.code, message: shape.message }, "Stripe rechazó una mutación de suscripción");
    throw new AppError("La suscripción ya no admite ese cambio.", 409);
  }
  translateStripeError(error);
}

function toId(value: string | { id: string } | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

function mapSetupStatus(status: Stripe.SetupIntent.Status): PaymentMethodSetupStatus {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "canceled":
    case "requires_payment_method":
      return "failed";
    default:
      return "pending";
  }
}

/** Único path de `expand` que ambos (`startSubscription`/`getSubscription`)
 * necesitan: expandir `confirmation_secret` (anidado) expande también su
 * padre `latest_invoice` a objeto completo (ver hallazgo 3). */
const SUBSCRIPTION_EXPAND = ["latest_invoice.confirmation_secret"];

/**
 * Product + Price encadenados, con keys de idempotencia DISTINTAS por
 * sub-recurso (`:product`/`:price` sobre la misma raíz): si el Product se
 * crea pero la llamada del Price falla, un reintento con la MISMA
 * `idempotencyKey` original reintentaría crear otro Product en vez de
 * reusar el que ya existe — separarlas deja cada paso reintentable de forma
 * independiente. `recurring: { interval: "month" }` es el único intervalo
 * que soporta `SubscriptionPlan.billingInterval` (ver el modelo).
 */
function createStripeSubscriptionProvider(client: StripeBillingClientLike): SubscriptionProvider {
  /** Relee la factura tras un fallo de `pay`. Si la relectura misma falla no
   * hay evidencia de que se haya resuelto: el error original sube. */
  async function isNoLongerOpen(invoiceRef: string): Promise<boolean> {
    try {
      const invoice = await client.invoices.retrieve(invoiceRef);
      return invoice.status !== "open";
    } catch {
      return false;
    }
  }

  return {
    async createPlanProduct(input: CreatePlanProductInput): Promise<PlanProductRefs> {
      try {
        const product = await client.products.create(
          {
            name: input.name,
            description: input.description,
            metadata: { planSlug: input.planSlug },
          },
          { idempotencyKey: `${input.idempotencyKey}:product` },
        );

        const price = await client.prices.create(
          {
            product: product.id,
            currency: input.currency,
            unit_amount: input.priceCents,
            recurring: { interval: "month" },
            metadata: { planSlug: input.planSlug },
          },
          { idempotencyKey: `${input.idempotencyKey}:price` },
        );

        return { productRef: product.id, priceRef: price.id };
      } catch (error) {
        translateStripeError(error);
      }
    },

    async ensureCustomer(input: EnsureCustomerInput): Promise<string> {
      try {
        const customer = await client.customers.create(
          { email: input.email, name: input.name },
          { idempotencyKey: input.idempotencyKey },
        );
        return customer.id;
      } catch (error) {
        translateStripeError(error);
      }
    },

    /**
     * Parámetros calcados del §A del plan: `default_incomplete` (el 3DS del
     * alta lo resuelve el Payment Element en sesión, ver traductor de
     * webhooks para la renovación off-session), solo tarjeta (nunca OXXO —
     * no es un método guardable), `proration_behavior: "none"` +
     * `add_invoice_items` para que la primera factura cobre el precio
     * COMPLETO del ciclo en vez de un prorrateo (decisión 4 del plan).
     */
    async startSubscription(input: StartProviderSubscriptionInput): Promise<ProviderSubscription> {
      try {
        const sub = await client.subscriptions.create(
          {
            customer: input.customerRef,
            items: [{ price: input.priceRef }],
            payment_behavior: "default_incomplete",
            payment_settings: {
              payment_method_types: ["card"],
              save_default_payment_method: "on_subscription",
            },
            billing_cycle_anchor_config: { day_of_month: input.billingAnchorDay, hour: BILLING_ANCHOR_HOUR_UTC },
            proration_behavior: "none",
            add_invoice_items: [{ price: input.priceRef }],
            metadata: input.metadata,
            expand: SUBSCRIPTION_EXPAND,
          },
          { idempotencyKey: input.idempotencyKey },
        );
        return toProviderSubscription(sub);
      } catch (error) {
        translateStripeError(error);
      }
    },

    async getSubscription(subscriptionRef: string): Promise<ProviderSubscription> {
      try {
        const sub = await client.subscriptions.retrieve(subscriptionRef, { expand: SUBSCRIPTION_EXPAND });
        return toProviderSubscription(sub);
      } catch (error) {
        translateStripeError(error);
      }
    },

    /** `void`: Stripe sigue generando las facturas del ciclo pero las anula,
     * así no se acumula deuda. El `status` NO pasa a `paused` (eso es otra
     * función, la de un trial sin tarjeta) — sigue `active`. Valor
     * idempotente por sí mismo: sin `idempotencyKey`. */
    async pauseCollection(input: PauseCollectionInput): Promise<ProviderSubscription> {
      try {
        const sub = await client.subscriptions.update(input.subscriptionRef, {
          pause_collection: { behavior: "void" },
        });
        return toProviderSubscription(sub);
      } catch (error) {
        translateSubscriptionMutationError(error);
      }
    },

    /** `pause_collection` es `Emptyable`: la cadena vacía la limpia. */
    async resumeCollection(input: PauseCollectionInput): Promise<ProviderSubscription> {
      try {
        const sub = await client.subscriptions.update(input.subscriptionRef, { pause_collection: "" });
        return toProviderSubscription(sub);
      } catch (error) {
        translateSubscriptionMutationError(error);
      }
    },

    async setCancelAtPeriodEnd(input: SetCancelAtPeriodEndInput): Promise<ProviderSubscription> {
      try {
        const sub = await client.subscriptions.update(input.subscriptionRef, {
          cancel_at_period_end: input.cancelAtPeriodEnd,
          ...(input.comment ? { cancellation_details: { comment: input.comment } } : {}),
        });
        return toProviderSubscription(sub);
      } catch (error) {
        translateSubscriptionMutationError(error);
      }
    },

    async cancelNow(input: CancelNowInput): Promise<ProviderSubscription> {
      try {
        const sub = await client.subscriptions.cancel(
          input.subscriptionRef,
          input.comment ? { cancellation_details: { comment: input.comment } } : {},
          { idempotencyKey: input.idempotencyKey },
        );
        return toProviderSubscription(sub);
      } catch (error) {
        translateSubscriptionMutationError(error);
      }
    },

    /** El `id` del ítem solo se conoce leyendo la suscripción, de ahí el
     * `retrieve` previo. `proration_behavior: "none"` + ancla `unchanged`: el
     * ciclo ya cobrado no cambia, el siguiente cobro anclado usa el precio
     * nuevo. Un intervalo distinto reiniciaría el ancla, pero solo existe
     * `month`. */
    async changePrice(input: ChangePriceInput): Promise<ProviderSubscription> {
      try {
        const current = await client.subscriptions.retrieve(input.subscriptionRef);
        const item = current.items.data[0];
        if (!item) {
          throw new AppError("No pudimos leer tu suscripción en el procesador de pagos.", 502);
        }
        const sub = await client.subscriptions.update(
          input.subscriptionRef,
          {
            items: [{ id: item.id, price: input.priceRef }],
            proration_behavior: "none",
            billing_cycle_anchor: "unchanged",
            metadata: input.metadata,
          },
          { idempotencyKey: input.idempotencyKey },
        );
        return toProviderSubscription(sub);
      } catch (error) {
        if (error instanceof AppError) throw error;
        translateSubscriptionMutationError(error);
      }
    },

    /** Solo tarjeta (decisión de 1.7.1) y `off_session`: la tarjeta se usará
     * para cobros recurrentes sin la clienta presente. Sin idempotencyKey: un
     * SetupIntent huérfano no cobra nada, y el rate limiter es el freno. */
    async createPaymentMethodSetup(input: PaymentMethodSetupInput): Promise<PaymentMethodSetup> {
      try {
        const setup = await client.setupIntents.create({
          customer: input.customerRef,
          usage: "off_session",
          payment_method_types: ["card"],
          metadata: { accountId: input.accountId, purpose: "subscription_payment_method" },
        });
        if (!setup.client_secret) {
          throw new AppError("No pudimos iniciar la actualización de tu tarjeta.", 502);
        }
        return { clientSecret: setup.client_secret };
      } catch (error) {
        if (error instanceof AppError) throw error;
        translateStripeError(error);
      }
    },

    /** El id lo manda el cliente: un `resource_missing` es "no existe" (404),
     * no un fallo del proveedor. */
    async getPaymentMethodSetup(setupRef: string): Promise<PaymentMethodSetupState> {
      try {
        const setup = await client.setupIntents.retrieve(setupRef);
        const customerRef = toId(setup.customer);
        const paymentMethodRef = toId(setup.payment_method);
        const accountIdHint = setup.metadata?.accountId;
        return {
          status: mapSetupStatus(setup.status),
          ...(customerRef ? { customerRef } : {}),
          ...(paymentMethodRef ? { paymentMethodRef } : {}),
          ...(accountIdHint ? { accountIdHint } : {}),
        };
      } catch (error) {
        if (readErrorShape(error).code === "resource_missing") {
          throw new AppError("Método de pago no encontrado.", 404);
        }
        translateStripeError(error);
      }
    },

    /** En la suscripción (manda sobre el default del customer) Y en el
     * customer (cubre una re-alta futura sobre el mismo Customer). */
    async setDefaultPaymentMethod(input: SetDefaultPaymentMethodInput): Promise<void> {
      try {
        await client.subscriptions.update(input.subscriptionRef, {
          default_payment_method: input.paymentMethodRef,
        });
        await client.customers.update(input.customerRef, {
          invoice_settings: { default_payment_method: input.paymentMethodRef },
        });
      } catch (error) {
        translateSubscriptionMutationError(error);
      }
    },

    /** Rechazo y SCA son desenlaces de negocio, no excepciones. Una factura
     * que ya no está `open` (pagada por el reintento automático de Stripe
     * entre medias, anulada…) no se vuelve a pagar. */
    async retryInvoicePayment(input: RetryInvoicePaymentInput): Promise<InvoiceRetryResult> {
      try {
        const invoice = await client.invoices.retrieve(input.invoiceRef);
        if (invoice.status !== "open") return { outcome: "already_settled" };

        const paid = await client.invoices.pay(
          input.invoiceRef,
          { payment_method: input.paymentMethodRef, off_session: true },
          { idempotencyKey: input.idempotencyKey },
        );
        return { outcome: paid.status === "paid" ? "paid" : "declined" };
      } catch (error) {
        const shape = readErrorShape(error);
        if (shape.type === "StripeCardError") {
          return { outcome: AUTHENTICATION_REQUIRED_CODES.has(shape.code ?? "") ? "requires_action" : "declined" };
        }
        // La factura pudo pagarse (el reintento automático de Stripe) ENTRE el
        // `retrieve` y el `pay`: eso llega como petición inválida. Se relee — si
        // ya no está `open`, es el mismo desenlace que el chequeo previo.
        if (shape.type === "StripeInvalidRequestError" && (await isNoLongerOpen(input.invoiceRef))) {
          return { outcome: "already_settled" };
        }
        translateStripeError(error);
      }
    },
  };
}

export { createStripeSubscriptionProvider };
export type { StripeBillingClientLike };
