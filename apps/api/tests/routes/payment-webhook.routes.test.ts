import { OrderStatus, PaymentMethod } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { PaymentEvent } from "../../src/models/payment-event.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { __setPaymentProviderForTests } from "../../src/services/payment-provider.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildStripeEvent, signPayload } from "../helpers/stripe-webhook-fixtures.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `POST /api/v1/webhooks/stripe` — §9 del plan de 1.6.2. El router se monta
 * ANTES de `cors`/`express.json`/`verifyOrigin`/el limiter global (ver
 * `app.ts`): estos tests verifican justo eso, no solo la lógica de negocio.
 */
const app = buildApp();
const WEBHOOK_URL = "/api/v1/webhooks/stripe";

describe("routes/payment-webhook — POST /webhooks/stripe", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function seedPendingCardOrder() {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: PaymentMethod.CARD });
    const { order } = await createOrder(input);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    __setPaymentProviderForTests(provider);
    const reloaded = await Order.findById(order._id).lean();
    return { order: reloaded!, variantId, provider };
  }

  it("firma inválida -> 400, ningún PaymentEvent ni orden tocados", async () => {
    const payload = buildStripeEvent("payment_intent.succeeded", "pi_bad_sig");
    const signature = signPayload(payload, { secret: "whsec_otro" });

    const res = await request(app)
      .post(WEBHOOK_URL)
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload);

    expect(res.status).toBe(400);
    expect(await PaymentEvent.countDocuments({})).toBe(0);
  });

  it("sin header stripe-signature -> 400", async () => {
    const payload = buildStripeEvent("payment_intent.succeeded", "pi_no_header");

    const res = await request(app).post(WEBHOOK_URL).set("Content-Type", "application/json").send(payload);

    expect(res.status).toBe(400);
  });

  it("body firmado con JSON indentado -> 200 (la ruta verifica el Buffer crudo, no un objeto re-serializado)", async () => {
    const { order } = await seedPendingCardOrder();
    __setPaymentProviderForTests(
      buildFakePaymentProvider({
        getAuthorization: vi.fn().mockResolvedValue({
          intentId: "pi_indented",
          status: "captured",
          amountCents: order.totalCents,
          currency: order.currency,
        }),
      }),
    );
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_indented" } });

    const rawEvent = {
      id: "evt_indented",
      object: "event",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_indented", object: "payment_intent", metadata: {} } },
    };
    const payload = JSON.stringify(rawEvent, null, 2);
    const signature = signPayload(payload);

    const res = await request(app)
      .post(WEBHOOK_URL)
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload);

    expect(res.status).toBe(200);
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
  });

  it("Origin de un sitio ajeno -> igual 200 (corre antes de cors/verifyOrigin/rate limit global)", async () => {
    const payload = buildStripeEvent("payment_intent.canceled", "pi_sin_orden_origin");
    const signature = signPayload(payload);

    const res = await request(app)
      .post(WEBHOOK_URL)
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .set("Origin", "https://evil.example")
      .send(payload);

    // 200 porque el rechazo de negocio ("order_not_found") responde 200 —
    // lo que este test verifica es que NO llegó un 403 de verifyOrigin/CORS.
    expect(res.status).toBe(200);
  });

  it("mismo evento entregado dos veces -> un solo efecto", async () => {
    const { order, variantId } = await seedPendingCardOrder();
    __setPaymentProviderForTests(
      buildFakePaymentProvider({
        getAuthorization: vi.fn().mockResolvedValue({
          intentId: "pi_dup",
          status: "captured",
          amountCents: order.totalCents,
          currency: order.currency,
        }),
      }),
    );
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_dup" } });

    const payload = buildStripeEvent("payment_intent.succeeded", "pi_dup", { metadata: {} });
    const signature = signPayload(payload);

    const first = await request(app).post(WEBHOOK_URL).set("Content-Type", "application/json").set("stripe-signature", signature).send(payload);
    const second = await request(app).post(WEBHOOK_URL).set("Content-Type", "application/json").set("stripe-signature", signature).send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(8);
  });

  it("el provider lanza al procesar -> 500 y el PaymentEvent queda failed", async () => {
    const { order } = await seedPendingCardOrder();
    __setPaymentProviderForTests(
      buildFakePaymentProvider({
        getAuthorization: vi.fn().mockRejectedValue(new Error("Fallo simulado")),
      }),
    );
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_throws" } });

    const payload = buildStripeEvent("payment_intent.succeeded", "pi_throws");
    const signature = signPayload(payload);

    const res = await request(app).post(WEBHOOK_URL).set("Content-Type", "application/json").set("stripe-signature", signature).send(payload);

    expect(res.status).toBe(500);
    const storedEvent = await PaymentEvent.findOne({});
    expect(storedEvent?.status).toBe("failed");
  });

  it("orden inexistente -> 200 y PaymentEvent failed", async () => {
    const payload = buildStripeEvent("payment_intent.succeeded", "pi_sin_orden");
    const signature = signPayload(payload);

    const res = await request(app).post(WEBHOOK_URL).set("Content-Type", "application/json").set("stripe-signature", signature).send(payload);

    expect(res.status).toBe(200);
    const storedEvent = await PaymentEvent.findOne({});
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("order_not_found");
  });

  it("sin proveedor configurado -> 503", async () => {
    __setPaymentProviderForTests(undefined);
    const payload = buildStripeEvent("payment_intent.succeeded", "pi_sin_proveedor");
    const signature = signPayload(payload);

    const res = await request(app).post(WEBHOOK_URL).set("Content-Type", "application/json").set("stripe-signature", signature).send(payload);

    expect(res.status).toBe(503);
  });
});
