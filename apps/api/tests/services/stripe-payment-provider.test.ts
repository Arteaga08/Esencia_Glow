import { PaymentMethod } from "@esencia-glow/shared";
import { describe, expect, it, vi } from "vitest";
import { createStripePaymentProvider } from "../../src/services/stripe-payment-provider.js";
import type { StripeClientLike } from "../../src/services/stripe-payment-provider.js";

/**
 * `createStripePaymentProvider` recibe el cliente por parámetro (§A del
 * plan de 1.6): esto permite testear el mapeo de parámetros/errores con un
 * cliente falso, sin red y sin llaves reales. El adapter habla nuestro
 * vocabulario — nada de `payment_intent`/`client_secret` crudo debe escapar
 * del archivo (ver ECOMMERCE_ARCHITECTURE_GUIDELINES.md).
 */
function buildFakeClient(overrides: Partial<StripeClientLike> = {}): StripeClientLike {
  return {
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
      cancel: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
    ...overrides,
  } as StripeClientLike;
}

describe("services/stripe-payment-provider — authorize", () => {
  it("tarjeta: crea el PI sin confirmar, con payment_method_types:['card'] y 3DS automatic explícito", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "pi_card_1",
      status: "requires_payment_method",
      client_secret: "pi_card_1_secret_abc",
      amount: 50000,
      currency: "mxn",
    });
    const client = buildFakeClient({ paymentIntents: { create, retrieve: vi.fn(), cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client);

    const result = await provider.authorize({
      orderId: "order-1",
      orderNumber: "EG-ABC12345",
      amountCents: 50000,
      currency: "mxn",
      method: PaymentMethod.CARD,
      customer: { email: "ana@example.com", name: "Ana Pérez" },
      shipping: {
        name: "Ana Pérez",
        address: { line1: "Av. Reforma 100", city: "CDMX", state: "CDMX", postal_code: "06600", country: "MX" },
      },
      idempotencyKey: "order:order-1:intent",
    });

    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0];
    expect(params.amount).toBe(50000);
    expect(params.currency).toBe("mxn");
    expect(params.payment_method_types).toEqual(["card"]);
    expect(params.confirm).toBeFalsy();
    expect(params.payment_method_options.card.request_three_d_secure).toBe("automatic");
    expect(params.metadata.orderId).toBe("order-1");
    expect(params.shipping.name).toBe("Ana Pérez");
    expect(options.idempotencyKey).toBe("order:order-1:intent");

    expect(result).toEqual({
      intentId: "pi_card_1",
      status: "awaiting_customer",
      clientSecret: "pi_card_1_secret_abc",
      amountCents: 50000,
      currency: "mxn",
    });
  });

  it("OXXO: crea y confirma el PI con billing_details y expires_after_days de Settings, devuelve la ficha", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "pi_oxxo_1",
      status: "requires_action",
      amount: 100000,
      currency: "mxn",
      next_action: {
        oxxo_display_details: {
          expires_after: 1767225599,
          hosted_voucher_url: "https://payments.stripe.com/oxxo/voucher/abc",
        },
      },
    });
    const client = buildFakeClient({ paymentIntents: { create, retrieve: vi.fn(), cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client);

    const result = await provider.authorize({
      orderId: "order-2",
      orderNumber: "EG-XYZ98765",
      amountCents: 100000,
      currency: "mxn",
      method: PaymentMethod.OXXO,
      customer: { email: "ana@example.com", name: "Ana Pérez" },
      shipping: {
        name: "Ana Pérez",
        address: { line1: "Av. Reforma 100", city: "CDMX", state: "CDMX", postal_code: "06600", country: "MX" },
      },
      oxxoVoucherDays: 2,
      idempotencyKey: "order:order-2:intent",
    });

    const [params] = create.mock.calls[0];
    expect(params.payment_method_types).toEqual(["oxxo"]);
    expect(params.confirm).toBe(true);
    expect(params.payment_method_data).toEqual({
      type: "oxxo",
      billing_details: { name: "Ana Pérez", email: "ana@example.com" },
    });
    expect(params.payment_method_options.oxxo.expires_after_days).toBe(2);
    expect(params.metadata.orderId).toBe("order-2");

    expect(result.status).toBe("awaiting_customer");
    expect(result.voucher).toEqual({
      expiresAt: new Date(1767225599 * 1000),
      hostedVoucherUrl: "https://payments.stripe.com/oxxo/voucher/abc",
    });
    expect(result.clientSecret).toBeUndefined();
  });

  it("monto fuera de rango en Stripe (StripeInvalidRequestError) se traduce a AppError 502", async () => {
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error("Amount must be at least..."), { type: "StripeInvalidRequestError" }),
    );
    const client = buildFakeClient({ paymentIntents: { create, retrieve: vi.fn(), cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client);

    await expect(
      provider.authorize({
        orderId: "order-3",
        orderNumber: "EG-000",
        amountCents: 500,
        currency: "mxn",
        method: PaymentMethod.CARD,
        customer: { email: "a@a.com", name: "A" },
        shipping: { name: "A", address: { line1: "x", city: "x", state: "x", postal_code: "x", country: "MX" } },
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("idempotency_error de Stripe se traduce a AppError 409", async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error("key reused"), { type: "StripeIdempotencyError" }));
    const client = buildFakeClient({ paymentIntents: { create, retrieve: vi.fn(), cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client);

    await expect(
      provider.authorize({
        orderId: "order-4",
        orderNumber: "EG-000",
        amountCents: 500,
        currency: "mxn",
        method: PaymentMethod.CARD,
        customer: { email: "a@a.com", name: "A" },
        shipping: { name: "A", address: { line1: "x", city: "x", state: "x", postal_code: "x", country: "MX" } },
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

const WEBHOOK_CONFIG = { secret: "whsec_test", toleranceSeconds: 300 };

describe("services/stripe-payment-provider — getAuthorization", () => {
  it("succeeded -> captured, pide latest_charge expandido y expone card brand/last4", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "pi_1",
      status: "succeeded",
      amount: 50000,
      currency: "mxn",
      latest_charge: { payment_method_details: { card: { brand: "visa", last4: "4242" } } },
    });
    const client = buildFakeClient({ paymentIntents: { create: vi.fn(), retrieve, cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const result = await provider.getAuthorization("pi_1");
    expect(retrieve).toHaveBeenCalledWith("pi_1", { expand: ["latest_charge"] });
    expect(result.status).toBe("captured");
    expect(result.card).toEqual({ brand: "visa", last4: "4242" });
  });

  it("latest_charge sin expandir (viene como id) -> sin card", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "pi_1b",
      status: "succeeded",
      amount: 50000,
      currency: "mxn",
      latest_charge: "ch_sin_expandir",
    });
    const client = buildFakeClient({ paymentIntents: { create: vi.fn(), retrieve, cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const result = await provider.getAuthorization("pi_1b");
    expect(result.card).toBeUndefined();
  });

  it("requires_payment_method -> requires_new_method", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "pi_2",
      status: "requires_payment_method",
      amount: 50000,
      currency: "mxn",
      last_payment_error: { message: "Tu tarjeta fue rechazada." },
    });
    const client = buildFakeClient({ paymentIntents: { create: vi.fn(), retrieve, cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const result = await provider.getAuthorization("pi_2");
    expect(result.status).toBe("requires_new_method");
    expect(result.lastError).toBe("Tu tarjeta fue rechazada.");
  });

  it("canceled -> canceled", async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: "pi_3", status: "canceled", amount: 50000, currency: "mxn" });
    const client = buildFakeClient({ paymentIntents: { create: vi.fn(), retrieve, cancel: vi.fn() } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const result = await provider.getAuthorization("pi_3");
    expect(result.status).toBe("canceled");
  });
});

describe("services/stripe-payment-provider — cancel", () => {
  it("cancela normalmente", async () => {
    const cancel = vi.fn().mockResolvedValue({ id: "pi_4", status: "canceled" });
    const client = buildFakeClient({ paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const outcome = await provider.cancel("pi_4", "order:1:cancel");
    expect(outcome).toBe("canceled");
    const [, , options] = cancel.mock.calls[0];
    expect(options.idempotencyKey).toBe("order:1:cancel");
  });

  it("ya capturado: Stripe rechaza el cancel -> already_captured", async () => {
    const cancel = vi.fn().mockRejectedValue(
      Object.assign(new Error("You cannot cancel this PaymentIntent because it has a status of succeeded"), {
        type: "StripeInvalidRequestError",
        code: "payment_intent_unexpected_state",
        payment_intent: { status: "succeeded" },
      }),
    );
    const client = buildFakeClient({ paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const outcome = await provider.cancel("pi_5", "order:2:cancel");
    expect(outcome).toBe("already_captured");
  });

  it("ya cancelado: Stripe rechaza el cancel con status canceled -> canceled (idempotente)", async () => {
    const cancel = vi.fn().mockRejectedValue(
      Object.assign(new Error("You cannot cancel this PaymentIntent because it has a status of canceled"), {
        type: "StripeInvalidRequestError",
        code: "payment_intent_unexpected_state",
        payment_intent: { status: "canceled" },
      }),
    );
    const client = buildFakeClient({ paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const outcome = await provider.cancel("pi_6", "order:3:cancel");
    expect(outcome).toBe("canceled");
  });
});

describe("services/stripe-payment-provider — refund", () => {
  it("reembolsa el monto pedido, con payment_intent + metadata.orderId + idempotencyKey", async () => {
    const create = vi.fn().mockResolvedValue({ id: "re_1", status: "succeeded" });
    const client = buildFakeClient({ refunds: { create } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const result = await provider.refund({
      orderId: "order-9",
      intentId: "pi_9",
      amountCents: 50000,
      idempotencyKey: "order:order-9:refund:123",
      requestedAtMs: 123,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0];
    expect(params).toEqual({
      payment_intent: "pi_9",
      amount: 50000,
      metadata: { orderId: "order-9", refundRequestedAtMs: "123" },
    });
    expect(options.idempotencyKey).toBe("order:order-9:refund:123");
    expect(result).toEqual({ refundId: "re_1", status: "succeeded" });
  });

  it("Stripe devuelve el reembolso en pending -> status pending", async () => {
    const create = vi.fn().mockResolvedValue({ id: "re_2", status: "pending" });
    const client = buildFakeClient({ refunds: { create } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    const result = await provider.refund({
      orderId: "order-10",
      intentId: "pi_10",
      amountCents: 50000,
      idempotencyKey: "k",
      requestedAtMs: 1,
    });
    expect(result.status).toBe("pending");
  });

  it("cargo ya reembolsado -> AppError 409", async () => {
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error("Charge has already been fully refunded"), {
        type: "StripeInvalidRequestError",
        code: "charge_already_refunded",
      }),
    );
    const client = buildFakeClient({ refunds: { create } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    await expect(
      provider.refund({ orderId: "order-11", intentId: "pi_11", amountCents: 50000, idempotencyKey: "k", requestedAtMs: 1 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("cargo en disputa -> AppError 409", async () => {
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error("Charge already has a dispute"), {
        type: "StripeInvalidRequestError",
        code: "charge_disputed",
      }),
    );
    const client = buildFakeClient({ refunds: { create } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    await expect(
      provider.refund({ orderId: "order-12", intentId: "pi_12", amountCents: 50000, idempotencyKey: "k", requestedAtMs: 1 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("monto mayor al remanente -> AppError 409", async () => {
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error("Refund amount is greater than unrefunded amount"), {
        type: "StripeInvalidRequestError",
        code: "amount_too_large",
      }),
    );
    const client = buildFakeClient({ refunds: { create } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    await expect(
      provider.refund({ orderId: "order-13", intentId: "pi_13", amountCents: 999999, idempotencyKey: "k", requestedAtMs: 1 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("cualquier otro fallo de Stripe -> AppError 502", async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error("API down"), { type: "StripeAPIError" }));
    const client = buildFakeClient({ refunds: { create } });
    const provider = createStripePaymentProvider(client, WEBHOOK_CONFIG);

    await expect(
      provider.refund({ orderId: "order-14", intentId: "pi_14", amountCents: 50000, idempotencyKey: "k", requestedAtMs: 1 }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("services/stripe-payment-provider — parseWebhookEvent", () => {
  it("sin secreto configurado -> 503", () => {
    const client = buildFakeClient();
    const provider = createStripePaymentProvider(client, { secret: undefined, toleranceSeconds: 300 });

    expect(() => provider.parseWebhookEvent(Buffer.from("{}"), "sig")).toThrow(
      expect.objectContaining({ statusCode: 503 }),
    );
  });
});
