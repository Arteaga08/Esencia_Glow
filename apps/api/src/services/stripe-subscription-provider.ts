import type Stripe from "stripe";
import { logger } from "../config/logger.js";
import { translateStripeError } from "./stripe-payment-provider.js";
import type {
  CreatePlanProductInput,
  EnsureCustomerInput,
  PlanProductRefs,
  ProviderSubscription,
  ProviderSubscriptionStatus,
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
  };
  subscriptions: {
    create: Stripe["subscriptions"]["create"];
    retrieve: Stripe["subscriptions"]["retrieve"];
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
  };
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
  };
}

export { createStripeSubscriptionProvider };
export type { StripeBillingClientLike };
