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

describe("services/stripe-subscription-provider — ensureCustomer", () => {
  it("crea el Customer con la idempotencyKey dada", async () => {
    const customersCreate = vi.fn().mockResolvedValue({ id: "cus_1" });
    const client = buildFakeClient({ customers: { create: customersCreate } });
    const provider = createStripeSubscriptionProvider(client);

    const customerRef = await provider.ensureCustomer({
      email: "cliente@example.com",
      name: "Cliente Glow",
      idempotencyKey: "user:abc:customer",
    });

    expect(customerRef).toBe("cus_1");
    const [params, options] = customersCreate.mock.calls[0];
    expect(params.email).toBe("cliente@example.com");
    expect(params.name).toBe("Cliente Glow");
    expect(options.idempotencyKey).toBe("user:abc:customer");
  });

  it("traduce un fallo de Stripe a 502", async () => {
    const customersCreate = vi.fn().mockRejectedValue({ type: "StripeAPIError" });
    const client = buildFakeClient({ customers: { create: customersCreate } });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.ensureCustomer({ email: "a@a.com", name: "A", idempotencyKey: "k" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

/**
 * Fabrica una `Stripe.Subscription` con la forma ANIDADA real de
 * `stripe@22.6.2` (hallazgos 1 y 3 del plan): el período vive en
 * `items.data[0].current_period_start/end`, nunca de primer nivel, y el
 * `clientSecret` sale de `latest_invoice.confirmation_secret.client_secret`
 * (el `latest_invoice` viene expandido a objeto completo por el
 * `expand: ["latest_invoice.confirmation_secret"]` que el adapter debe pedir).
 */
function buildFakeStripeSubscription(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const anchor = now + 10 * 24 * 60 * 60;
  return {
    id: "sub_1",
    object: "subscription",
    status: "incomplete",
    billing_cycle_anchor: anchor,
    items: {
      object: "list",
      data: [{ current_period_start: now, current_period_end: anchor }],
    },
    latest_invoice: {
      id: "in_1",
      object: "invoice",
      amount_due: 59900,
      currency: "mxn",
      confirmation_secret: { client_secret: "pi_1_secret_abc", type: "payment_intent" },
    },
    ...overrides,
  };
}

describe("services/stripe-subscription-provider — startSubscription", () => {
  it("crea la suscripción con default_incomplete/anchor/add_invoice_items y traduce la respuesta anidada", async () => {
    const subscriptionsCreate = vi.fn().mockResolvedValue(buildFakeStripeSubscription());
    const client = buildFakeClient({ subscriptions: { create: subscriptionsCreate, retrieve: vi.fn() } });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.startSubscription({
      customerRef: "cus_1",
      priceRef: "price_1",
      billingAnchorDay: 15,
      metadata: { accountId: "acc_1", userId: "user_1", planId: "plan_1" },
      idempotencyKey: "account:acc_1:sub:1000",
    });

    expect(result.subscriptionRef).toBe("sub_1");
    expect(result.status).toBe("incomplete");
    expect(result.clientSecret).toBe("pi_1_secret_abc");
    expect(result.firstChargeCents).toBe(59900);
    expect(result.currency).toBe("mxn");
    expect(result.nextChargeAt).toBeInstanceOf(Date);
    expect(result.currentPeriodStart).toBeInstanceOf(Date);
    expect(result.currentPeriodEnd).toBeInstanceOf(Date);

    const [params, options] = subscriptionsCreate.mock.calls[0];
    expect(params.customer).toBe("cus_1");
    expect(params.items).toEqual([{ price: "price_1" }]);
    expect(params.payment_behavior).toBe("default_incomplete");
    expect(params.payment_settings).toEqual({
      payment_method_types: ["card"],
      save_default_payment_method: "on_subscription",
    });
    expect(params.billing_cycle_anchor_config).toEqual({ day_of_month: 15, hour: 15 });
    expect(params.proration_behavior).toBe("none");
    expect(params.add_invoice_items).toEqual([{ price: "price_1" }]);
    expect(params.metadata).toEqual({ accountId: "acc_1", userId: "user_1", planId: "plan_1" });
    expect(params.expand).toEqual(["latest_invoice.confirmation_secret"]);
    expect(options.idempotencyKey).toBe("account:acc_1:sub:1000");
  });

  it("traduce un fallo de Stripe a 502", async () => {
    const subscriptionsCreate = vi.fn().mockRejectedValue({ type: "StripeAPIError" });
    const client = buildFakeClient({ subscriptions: { create: subscriptionsCreate, retrieve: vi.fn() } });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.startSubscription({
        customerRef: "cus_1",
        priceRef: "price_1",
        billingAnchorDay: 1,
        metadata: { accountId: "a", userId: "u", planId: "p" },
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("services/stripe-subscription-provider — getSubscription", () => {
  it("consulta y traduce con la misma forma anidada que startSubscription", async () => {
    const subscriptionsRetrieve = vi.fn().mockResolvedValue(buildFakeStripeSubscription({ status: "active" }));
    const client = buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: subscriptionsRetrieve } });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.getSubscription("sub_1");

    expect(result.subscriptionRef).toBe("sub_1");
    expect(result.status).toBe("active");
    expect(result.clientSecret).toBe("pi_1_secret_abc");

    const [id, options] = subscriptionsRetrieve.mock.calls[0];
    expect(id).toBe("sub_1");
    expect(options.expand).toEqual(["latest_invoice.confirmation_secret"]);
  });

  it("unpaid/incomplete_expired mapean a canceled", async () => {
    const subscriptionsRetrieve = vi
      .fn()
      .mockResolvedValue(buildFakeStripeSubscription({ status: "unpaid", latest_invoice: null }));
    const client = buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: subscriptionsRetrieve } });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.getSubscription("sub_1");
    expect(result.status).toBe("canceled");
    expect(result.clientSecret).toBeUndefined();
  });

  it("un estado crudo NO reconocido (fuera del enum actual de Stripe) mapea a incomplete sin lanzar", async () => {
    const subscriptionsRetrieve = vi
      .fn()
      .mockResolvedValue(buildFakeStripeSubscription({ status: "some_future_status" }));
    const client = buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: subscriptionsRetrieve } });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.getSubscription("sub_1");
    expect(result.status).toBe("incomplete");
  });

  it("trialing mapea a active (riesgo aceptado 🟡 #4: trial manual desde el Dashboard da acceso sin pago)", async () => {
    const subscriptionsRetrieve = vi.fn().mockResolvedValue(buildFakeStripeSubscription({ status: "trialing" }));
    const client = buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: subscriptionsRetrieve } });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.getSubscription("sub_1");
    expect(result.status).toBe("active");
  });

  it("traduce un fallo de Stripe a 502", async () => {
    const subscriptionsRetrieve = vi.fn().mockRejectedValue({ type: "StripeAPIError" });
    const client = buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: subscriptionsRetrieve } });
    const provider = createStripeSubscriptionProvider(client);

    await expect(provider.getSubscription("sub_1")).rejects.toMatchObject({ statusCode: 502 });
  });
});
