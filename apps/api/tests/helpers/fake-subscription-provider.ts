import { vi } from "vitest";
import type { SubscriptionProvider } from "../../src/services/subscription-provider.js";

/**
 * Proveedor de Stripe Billing falso, determinista y sin red — mismo patrón
 * que fake-payment-provider.ts. Refs deterministas por contador para poder
 * asertar sobre ellas en los tests.
 */
function buildFakeSubscriptionProvider(overrides: Partial<SubscriptionProvider> = {}): SubscriptionProvider {
  let counter = 0;

  return {
    createPlanProduct: vi.fn().mockImplementation(async () => {
      counter += 1;
      return { productRef: `prod_fake_${counter}`, priceRef: `price_fake_${counter}` };
    }),
    ...overrides,
  };
}

export { buildFakeSubscriptionProvider };
