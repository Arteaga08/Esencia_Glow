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
    customers: { create: vi.fn(), update: vi.fn() },
    subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    setupIntents: { create: vi.fn(), retrieve: vi.fn() },
    invoices: { retrieve: vi.fn(), pay: vi.fn() },
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


/** Suscripción cruda mínima de Stripe (forma `dahlia`: período e id de precio
 * viven en `items.data[0]`). */
function rawSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    billing_cycle_anchor: 1_700_000_000,
    cancel_at_period_end: false,
    pause_collection: null,
    latest_invoice: null,
    items: {
      data: [
        { id: "si_1", current_period_start: 1_700_000_000, current_period_end: 1_702_592_000, price: { id: "price_old" } },
      ],
    },
    ...overrides,
  };
}

describe("services/stripe-subscription-provider — pausa y reanudación", () => {
  it("pauseCollection manda pause_collection {behavior:'void'} (el status en Stripe sigue 'active') y refleja collectionPaused", async () => {
    const update = vi.fn().mockResolvedValue(rawSubscription({ pause_collection: { behavior: "void", resumes_at: null } }));
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: vi.fn(), update, cancel: vi.fn() } }),
    );

    const result = await provider.pauseCollection({ subscriptionRef: "sub_1" });

    expect(update).toHaveBeenCalledWith("sub_1", { pause_collection: { behavior: "void" } });
    expect(result).toMatchObject({ subscriptionRef: "sub_1", status: "active", collectionPaused: true });
  });

  it("resumeCollection manda pause_collection '' (Emptyable) para limpiar la pausa", async () => {
    const update = vi.fn().mockResolvedValue(rawSubscription());
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: vi.fn(), update, cancel: vi.fn() } }),
    );

    const result = await provider.resumeCollection({ subscriptionRef: "sub_1" });

    expect(update).toHaveBeenCalledWith("sub_1", { pause_collection: "" });
    expect(result.collectionPaused).toBe(false);
  });

  it("una suscripción ya cancelada (StripeInvalidRequestError) es 409, no 502", async () => {
    const update = vi.fn().mockRejectedValue({ type: "StripeInvalidRequestError", message: "canceled subscription" });
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: vi.fn(), update, cancel: vi.fn() } }),
    );

    await expect(provider.pauseCollection({ subscriptionRef: "sub_1" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("un fallo de red/API es 502", async () => {
    const update = vi.fn().mockRejectedValue({ type: "StripeAPIError" });
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: vi.fn(), update, cancel: vi.fn() } }),
    );

    await expect(provider.resumeCollection({ subscriptionRef: "sub_1" })).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("services/stripe-subscription-provider — cancelación", () => {
  it("setCancelAtPeriodEnd(true) manda cancel_at_period_end y el motivo como cancellation_details.comment", async () => {
    const update = vi.fn().mockResolvedValue(rawSubscription({ cancel_at_period_end: true }));
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: vi.fn(), update, cancel: vi.fn() } }),
    );

    const result = await provider.setCancelAtPeriodEnd({
      subscriptionRef: "sub_1",
      cancelAtPeriodEnd: true,
      comment: "Me mudo",
    });

    expect(update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
      cancellation_details: { comment: "Me mudo" },
    });
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  it("setCancelAtPeriodEnd(false) sin motivo NO manda cancellation_details", async () => {
    const update = vi.fn().mockResolvedValue(rawSubscription());
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: vi.fn(), update, cancel: vi.fn() } }),
    );

    await provider.setCancelAtPeriodEnd({ subscriptionRef: "sub_1", cancelAtPeriodEnd: false });

    expect(update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false });
  });

  it("cancelNow cancela de inmediato con idempotencyKey y el motivo como comment", async () => {
    const cancel = vi.fn().mockResolvedValue(rawSubscription({ status: "canceled" }));
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), cancel } }),
    );

    const result = await provider.cancelNow({
      subscriptionRef: "sub_1",
      comment: "Ya no la uso",
      idempotencyKey: "account:a1:cancel:1",
    });

    expect(cancel).toHaveBeenCalledWith(
      "sub_1",
      { cancellation_details: { comment: "Ya no la uso" } },
      { idempotencyKey: "account:a1:cancel:1" },
    );
    expect(result.status).toBe("canceled");
  });
});

describe("services/stripe-subscription-provider — cambio de plan", () => {
  it("changePrice recupera el ítem, cambia SU precio sin prorrateo y con el ancla intacta", async () => {
    const retrieve = vi.fn().mockResolvedValue(rawSubscription());
    const update = vi.fn().mockResolvedValue(
      rawSubscription({
        items: {
          data: [{ id: "si_1", current_period_start: 1_700_000_000, current_period_end: 1_702_592_000, price: { id: "price_new" } }],
        },
      }),
    );
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve, update, cancel: vi.fn() } }),
    );

    const result = await provider.changePrice({
      subscriptionRef: "sub_1",
      priceRef: "price_new",
      metadata: { planId: "plan_new" },
      idempotencyKey: "account:a1:plan:1",
    });

    expect(update).toHaveBeenCalledWith(
      "sub_1",
      {
        items: [{ id: "si_1", price: "price_new" }],
        proration_behavior: "none",
        billing_cycle_anchor: "unchanged",
        metadata: { planId: "plan_new" },
      },
      { idempotencyKey: "account:a1:plan:1" },
    );
    expect(result.priceRef).toBe("price_new");
  });

  it("changePrice sobre una suscripción sin ítems es 502 (datos corruptos del proveedor), nunca llama a update", async () => {
    const retrieve = vi.fn().mockResolvedValue(rawSubscription({ items: { data: [] } }));
    const update = vi.fn();
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve, update, cancel: vi.fn() } }),
    );

    await expect(
      provider.changePrice({ subscriptionRef: "sub_1", priceRef: "p", metadata: { planId: "x" }, idempotencyKey: "k" }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("services/stripe-subscription-provider — método de pago", () => {
  it("createPaymentMethodSetup crea un SetupIntent off_session solo-tarjeta con el accountId en metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "seti_1", client_secret: "seti_1_secret" });
    const provider = createStripeSubscriptionProvider(buildFakeClient({ setupIntents: { create, retrieve: vi.fn() } }));

    const result = await provider.createPaymentMethodSetup({ customerRef: "cus_1", accountId: "acc_1" });

    expect(create).toHaveBeenCalledWith({
      customer: "cus_1",
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { accountId: "acc_1", purpose: "subscription_payment_method" },
    });
    expect(result).toEqual({ clientSecret: "seti_1_secret" });
  });

  it("createPaymentMethodSetup sin client_secret en la respuesta es 502", async () => {
    const create = vi.fn().mockResolvedValue({ id: "seti_1", client_secret: null });
    const provider = createStripeSubscriptionProvider(buildFakeClient({ setupIntents: { create, retrieve: vi.fn() } }));

    await expect(provider.createPaymentMethodSetup({ customerRef: "cus_1", accountId: "acc_1" })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("getPaymentMethodSetup normaliza customer/payment_method (pueden venir expandidos como objeto) y traduce el status", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "seti_1",
      status: "succeeded",
      customer: { id: "cus_1" },
      payment_method: { id: "pm_1" },
      metadata: { accountId: "acc_1" },
    });
    const provider = createStripeSubscriptionProvider(buildFakeClient({ setupIntents: { create: vi.fn(), retrieve } }));

    const result = await provider.getPaymentMethodSetup("seti_1");

    expect(result).toEqual({ status: "succeeded", customerRef: "cus_1", paymentMethodRef: "pm_1", accountIdHint: "acc_1" });
  });

  it.each([
    ["requires_action", "pending"],
    ["processing", "pending"],
    ["requires_confirmation", "pending"],
    ["canceled", "failed"],
    ["requires_payment_method", "failed"],
  ])("getPaymentMethodSetup: status '%s' -> '%s'", async (stripeStatus, expected) => {
    const retrieve = vi.fn().mockResolvedValue({ id: "seti_1", status: stripeStatus, customer: "cus_1", payment_method: null, metadata: {} });
    const provider = createStripeSubscriptionProvider(buildFakeClient({ setupIntents: { create: vi.fn(), retrieve } }));

    expect((await provider.getPaymentMethodSetup("seti_1")).status).toBe(expected);
  });

  it("getPaymentMethodSetup: un SetupIntent inexistente (resource_missing) es 404", async () => {
    const retrieve = vi.fn().mockRejectedValue({ type: "StripeInvalidRequestError", code: "resource_missing" });
    const provider = createStripeSubscriptionProvider(buildFakeClient({ setupIntents: { create: vi.fn(), retrieve } }));

    await expect(provider.getPaymentMethodSetup("seti_x")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("setDefaultPaymentMethod la fija en la suscripción Y en el customer (cubre una re-alta futura)", async () => {
    const subUpdate = vi.fn().mockResolvedValue(rawSubscription());
    const customerUpdate = vi.fn().mockResolvedValue({ id: "cus_1" });
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({
        subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: subUpdate, cancel: vi.fn() },
        customers: { create: vi.fn(), update: customerUpdate },
      }),
    );

    await provider.setDefaultPaymentMethod({ subscriptionRef: "sub_1", customerRef: "cus_1", paymentMethodRef: "pm_1" });

    expect(subUpdate).toHaveBeenCalledWith("sub_1", { default_payment_method: "pm_1" });
    expect(customerUpdate).toHaveBeenCalledWith("cus_1", { invoice_settings: { default_payment_method: "pm_1" } });
  });
});

describe("services/stripe-subscription-provider — retryInvoicePayment", () => {
  function buildInvoiceClient(retrieveResult: unknown, payImpl: ReturnType<typeof vi.fn>) {
    return buildFakeClient({
      invoices: { retrieve: vi.fn().mockResolvedValue(retrieveResult), pay: payImpl },
    });
  }

  it("paga la factura abierta off_session con el método indicado y la idempotencyKey -> 'paid'", async () => {
    const pay = vi.fn().mockResolvedValue({ id: "in_1", status: "paid" });
    const provider = createStripeSubscriptionProvider(buildInvoiceClient({ id: "in_1", status: "open" }, pay));

    const result = await provider.retryInvoicePayment({ invoiceRef: "in_1", paymentMethodRef: "pm_1", idempotencyKey: "k1" });

    expect(pay).toHaveBeenCalledWith("in_1", { payment_method: "pm_1", off_session: true }, { idempotencyKey: "k1" });
    expect(result).toEqual({ outcome: "paid" });
  });

  it("una factura que ya no está 'open' -> 'already_settled' y NUNCA llama a pay", async () => {
    const pay = vi.fn();
    const provider = createStripeSubscriptionProvider(buildInvoiceClient({ id: "in_1", status: "paid" }, pay));

    const result = await provider.retryInvoicePayment({ invoiceRef: "in_1", paymentMethodRef: "pm_1", idempotencyKey: "k1" });

    expect(result).toEqual({ outcome: "already_settled" });
    expect(pay).not.toHaveBeenCalled();
  });

  it("tarjeta rechazada (StripeCardError) es un OUTCOME 'declined', no una excepción", async () => {
    const pay = vi.fn().mockRejectedValue({ type: "StripeCardError", code: "card_declined" });
    const provider = createStripeSubscriptionProvider(buildInvoiceClient({ id: "in_1", status: "open" }, pay));

    await expect(
      provider.retryInvoicePayment({ invoiceRef: "in_1", paymentMethodRef: "pm_1", idempotencyKey: "k1" }),
    ).resolves.toEqual({ outcome: "declined" });
  });

  it.each(["authentication_required", "invoice_payment_intent_requires_action"])(
    "código '%s' es un OUTCOME 'requires_action'",
    async (code) => {
      const pay = vi.fn().mockRejectedValue({ type: "StripeCardError", code });
      const provider = createStripeSubscriptionProvider(buildInvoiceClient({ id: "in_1", status: "open" }, pay));

      await expect(
        provider.retryInvoicePayment({ invoiceRef: "in_1", paymentMethodRef: "pm_1", idempotencyKey: "k1" }),
      ).resolves.toEqual({ outcome: "requires_action" });
    },
  );

  it("la factura se pagó ENTRE el retrieve y el pay (StripeInvalidRequestError): relee, ya no está open -> 'already_settled', no un 502", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValueOnce({ id: "in_1", status: "open" })
      .mockResolvedValueOnce({ id: "in_1", status: "paid" });
    const pay = vi.fn().mockRejectedValue({ type: "StripeInvalidRequestError", message: "Invoice is already paid" });
    const provider = createStripeSubscriptionProvider(buildFakeClient({ invoices: { retrieve, pay } }));

    await expect(
      provider.retryInvoicePayment({ invoiceRef: "in_1", paymentMethodRef: "pm_1", idempotencyKey: "k1" }),
    ).resolves.toEqual({ outcome: "already_settled" });
  });

  it("StripeInvalidRequestError con la factura TODAVÍA open es un error real: 502", async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: "in_1", status: "open" });
    const pay = vi.fn().mockRejectedValue({ type: "StripeInvalidRequestError", message: "otra cosa" });
    const provider = createStripeSubscriptionProvider(buildFakeClient({ invoices: { retrieve, pay } }));

    await expect(
      provider.retryInvoicePayment({ invoiceRef: "in_1", paymentMethodRef: "pm_1", idempotencyKey: "k1" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("cualquier otro fallo de Stripe sigue siendo 502", async () => {
    const pay = vi.fn().mockRejectedValue({ type: "StripeAPIError" });
    const provider = createStripeSubscriptionProvider(buildInvoiceClient({ id: "in_1", status: "open" }, pay));

    await expect(
      provider.retryInvoicePayment({ invoiceRef: "in_1", paymentMethodRef: "pm_1", idempotencyKey: "k1" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("services/stripe-subscription-provider — snapshot", () => {
  it("getSubscription expone collectionPaused, cancelAtPeriodEnd y priceRef", async () => {
    const retrieve = vi.fn().mockResolvedValue(rawSubscription({ cancel_at_period_end: true }));
    const provider = createStripeSubscriptionProvider(
      buildFakeClient({ subscriptions: { create: vi.fn(), retrieve, update: vi.fn(), cancel: vi.fn() } }),
    );

    const result = await provider.getSubscription("sub_1");

    expect(result).toMatchObject({ collectionPaused: false, cancelAtPeriodEnd: true, priceRef: "price_old" });
  });
});
