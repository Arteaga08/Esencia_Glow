import { vi } from "vitest";
import type { ProviderSubscription, SubscriptionProvider } from "../../src/services/subscription-provider.js";

/**
 * Proveedor de Stripe Billing falso, determinista y sin red — mismo patrón
 * que fake-payment-provider.ts. Refs deterministas por contador para poder
 * asertar sobre ellas en los tests.
 *
 * `startSubscription`/`getSubscription` (Fase 4) devuelven `status:
 * "incomplete"` con `clientSecret` — el golden path del endpoint de alta
 * nunca activa la cuenta por sí solo, eso lo decide el webhook real.
 */
function buildFakeSubscriptionProvider(overrides: Partial<SubscriptionProvider> = {}): SubscriptionProvider {
  let counter = 0;
  const subscriptions = new Map<string, ProviderSubscription>();

  return {
    createPlanProduct: vi.fn().mockImplementation(async () => {
      counter += 1;
      return { productRef: `prod_fake_${counter}`, priceRef: `price_fake_${counter}` };
    }),
    ensureCustomer: vi.fn().mockImplementation(async () => {
      counter += 1;
      return `cus_fake_${counter}`;
    }),
    startSubscription: vi.fn().mockImplementation(async () => {
      counter += 1;
      const subscriptionRef = `sub_fake_${counter}`;
      const subscription: ProviderSubscription = {
        subscriptionRef,
        status: "incomplete",
        clientSecret: `pi_fake_${counter}_secret`,
        firstChargeCents: 59900,
        currency: "mxn",
        nextChargeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };
      subscriptions.set(subscriptionRef, subscription);
      return subscription;
    }),
    getSubscription: vi.fn().mockImplementation(async (subscriptionRef: string) => {
      const found = subscriptions.get(subscriptionRef);
      if (found) return found;
      return {
        subscriptionRef,
        status: "incomplete",
        clientSecret: `pi_fake_unknown_secret`,
        firstChargeCents: 59900,
        currency: "mxn",
        nextChargeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      } satisfies ProviderSubscription;
    }),
    ...overrides,
  };
}

export { buildFakeSubscriptionProvider };
