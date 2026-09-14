import type Stripe from "stripe";
import { translateStripeError } from "./stripe-payment-provider.js";
import type { CreatePlanProductInput, PlanProductRefs, SubscriptionProvider } from "./subscription-provider.js";

/**
 * Único archivo (junto a subscription-provider.ts) donde puede aparecer
 * vocabulario crudo de Stripe Billing. Interfaz estructural angosta del
 * cliente — mismo patrón que `StripeClientLike` en stripe-payment-provider.ts:
 * permite testear el mapeo con un cliente falso sin depender del tipo
 * completo del SDK.
 *
 * Solo `products`/`prices` hoy (lo único que Fase 1 usa); `customers` y
 * `subscriptions` se agregan cuando el endpoint de alta los necesite.
 */
interface StripeBillingClientLike {
  products: {
    create: Stripe["products"]["create"];
  };
  prices: {
    create: Stripe["prices"]["create"];
  };
}

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
  };
}

export { createStripeSubscriptionProvider };
export type { StripeBillingClientLike };
