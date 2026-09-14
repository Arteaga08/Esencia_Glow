import { describe, expect, it, vi } from "vitest";
import { createStripeSubscriptionProvider } from "../../src/services/stripe-subscription-provider.js";
import type { StripeBillingClientLike } from "../../src/services/stripe-subscription-provider.js";

/**
 * `createStripeSubscriptionProvider` recibe el cliente por parámetro, mismo
 * patrón que `createStripePaymentProvider` (§A del plan de 1.7.2a): permite
 * testear el mapeo de parámetros/errores con un cliente falso, sin red y sin
 * llaves reales.
 */
function buildFakeClient(overrides: Partial<StripeBillingClientLike> = {}): StripeBillingClientLike {
  return {
    products: { create: vi.fn() },
    prices: { create: vi.fn() },
    customers: { create: vi.fn() },
    subscriptions: { create: vi.fn(), retrieve: vi.fn() },
    ...overrides,
  } as StripeBillingClientLike;
}

describe("services/stripe-subscription-provider — createPlanProduct", () => {
  it("crea el Product y el Price encadenados, mensual, con keys de idempotencia distintas por sub-recurso", async () => {
    const productsCreate = vi.fn().mockResolvedValue({ id: "prod_1" });
    const pricesCreate = vi.fn().mockResolvedValue({ id: "price_1" });
    const client = buildFakeClient({
      products: { create: productsCreate },
      prices: { create: pricesCreate },
    });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.createPlanProduct({
      planSlug: "caja-esencia",
      name: "Caja Esencia",
      description: "Caja mensual curada",
      priceCents: 59900,
      currency: "mxn",
      idempotencyKey: "plan:caja-esencia",
    });

    expect(result).toEqual({ productRef: "prod_1", priceRef: "price_1" });

    const [productParams, productOptions] = productsCreate.mock.calls[0];
    expect(productParams.name).toBe("Caja Esencia");
    expect(productParams.description).toBe("Caja mensual curada");
    expect(productParams.metadata.planSlug).toBe("caja-esencia");
    expect(productOptions.idempotencyKey).toBe("plan:caja-esencia:product");

    const [priceParams, priceOptions] = pricesCreate.mock.calls[0];
    expect(priceParams.product).toBe("prod_1");
    expect(priceParams.unit_amount).toBe(59900);
    expect(priceParams.currency).toBe("mxn");
    expect(priceParams.recurring).toEqual({ interval: "month" });
    expect(priceOptions.idempotencyKey).toBe("plan:caja-esencia:price");
  });

  it("traduce un fallo de Stripe a 502 (mismo criterio que el adapter de pagos)", async () => {
    const productsCreate = vi.fn().mockRejectedValue({ type: "StripeAPIError" });
    const client = buildFakeClient({ products: { create: productsCreate } });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.createPlanProduct({
        planSlug: "caja-esencia",
        name: "Caja Esencia",
        description: "Caja mensual curada",
        priceCents: 59900,
        currency: "mxn",
        idempotencyKey: "plan:caja-esencia",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("un reintento de idempotencia con datos distintos es 409 (reusa translateStripeError del adapter de pagos)", async () => {
    const productsCreate = vi.fn().mockRejectedValue({ type: "StripeIdempotencyError" });
    const client = buildFakeClient({ products: { create: productsCreate } });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.createPlanProduct({
        planSlug: "caja-esencia",
        name: "Caja Esencia",
        description: "Caja mensual curada",
        priceCents: 59900,
        currency: "mxn",
        idempotencyKey: "plan:caja-esencia",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
