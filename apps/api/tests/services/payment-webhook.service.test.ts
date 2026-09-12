import { randomUUID } from "node:crypto";
import { OrderStatus, PaymentMethod } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { PaymentEvent } from "../../src/models/payment-event.model.js";
import { User } from "../../src/models/user.model.js";
import { AppError } from "../../src/utils/app-error.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { processPaymentWebhook } from "../../src/services/payment-webhook.service.js";
import type { PaymentWebhookEvent } from "../../src/services/payment-provider.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `payment-webhook.service.ts` — orquestador + handlers (§7 del plan de
 * 1.6.2), ejercitado con eventos de dominio construidos a mano (el
 * traductor de Stripe ya se prueba aparte en `stripe-webhook-translator`)
 * y un `PaymentProvider` falso para no depender de red.
 */
describe("services/payment-webhook — processPaymentWebhook", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createUser(): Promise<string> {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    return userId;
  }

  async function createPendingOrder(method: PaymentMethod) {
    const userId = await createUser();
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: method });
    const { order } = await createOrder(input);
    return { order, userId, variantId };
  }

  function capturedEvent(intentId: string, orderIdHint?: string): PaymentWebhookEvent {
    return {
      kind: "payment.captured",
      eventId: `evt_${randomUUID()}`,
      providerType: "payment_intent.succeeded",
      intentId,
      ...(orderIdHint ? { orderIdHint } : {}),
    };
  }

  function failedEvent(intentId: string, opts: { orderIdHint?: string; lastError?: string } = {}): PaymentWebhookEvent {
    return {
      kind: "payment.failed",
      eventId: `evt_${randomUUID()}`,
      providerType: "payment_intent.payment_failed",
      intentId,
      ...(opts.orderIdHint ? { orderIdHint: opts.orderIdHint } : {}),
      ...(opts.lastError ? { lastError: opts.lastError } : {}),
    };
  }

  function canceledEvent(intentId: string, orderIdHint?: string): PaymentWebhookEvent {
    return {
      kind: "payment.canceled",
      eventId: `evt_${randomUUID()}`,
      providerType: "payment_intent.canceled",
      intentId,
      ...(orderIdHint ? { orderIdHint } : {}),
    };
  }

  function refundedEvent(
    intentId: string,
    opts: { amountRefundedCents: number; currency?: string },
  ): PaymentWebhookEvent {
    return {
      kind: "payment.refunded",
      eventId: `evt_${randomUUID()}`,
      providerType: "charge.refunded",
      intentId,
      amountRefundedCents: opts.amountRefundedCents,
      currency: opts.currency ?? "mxn",
    };
  }

  function refundFailedEvent(intentId: string, opts: { refundId?: string; reason?: string } = {}): PaymentWebhookEvent {
    return {
      kind: "refund.failed",
      eventId: `evt_${randomUUID()}`,
      providerType: "charge.refund.updated",
      intentId,
      refundId: opts.refundId ?? "re_fake",
      ...(opts.reason ? { reason: opts.reason } : {}),
    };
  }

  function disputeOpenedEvent(intentId: string): PaymentWebhookEvent {
    return {
      kind: "dispute.opened",
      eventId: `evt_${randomUUID()}`,
      providerType: "charge.dispute.created",
      intentId,
      disputeId: "dp_fake",
    };
  }

  function disputeClosedEvent(intentId: string, outcome: "won" | "lost" | "withdrawn"): PaymentWebhookEvent {
    return {
      kind: "dispute.closed",
      eventId: `evt_${randomUUID()}`,
      providerType: "charge.dispute.closed",
      intentId,
      disputeId: "dp_fake",
      outcome,
    };
  }

  it("payment.captured -> paid, stock comprometido, tarjeta guardada; reentrega no duplica ORDER_PAID", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_ok",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
        card: { brand: "visa", last4: "4242" },
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_ok" } });

    const event = capturedEvent("pi_ok");
    await processPaymentWebhook(event, provider);

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.status).toBe(OrderStatus.PAID);
    expect(reloaded?.payment.card).toEqual({ brand: "visa", last4: "4242" });
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(8);

    // Reentrega del MISMO evento (mismo eventId): el dedupe lo detiene
    // antes de despachar.
    await processPaymentWebhook(event, provider);
    const paidAudits = await AuditLog.countDocuments({ action: "order_paid", targetId: order._id });
    expect(paidAudits).toBe(1);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
  });

  it("payment.captured con monto distinto -> sin transición, PaymentEvent queda failed, no lanza", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_mismatch",
        status: "captured",
        amountCents: order.totalCents + 100,
        currency: order.currency,
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_mismatch" } });

    const event = capturedEvent("pi_mismatch");
    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("amount_mismatch");
  });

  it("orden inexistente -> PaymentEvent failed 'order_not_found', no lanza", async () => {
    const provider = buildFakePaymentProvider();
    const event = capturedEvent("pi_sin_orden");

    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("order_not_found");
  });

  it("localizar por metadata: orden sin intent todavía la adopta y paga", async () => {
    const { order } = await createPendingOrder(PaymentMethod.CARD);
    // A propósito: NUNCA se llama ensurePaymentIntent — simula que Stripe
    // ya creó el PI pero la orden no alcanzó a guardar el intentId.
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_via_metadata",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
      }),
    });

    const event = capturedEvent("pi_via_metadata", order._id.toString());
    await processPaymentWebhook(event, provider);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
    expect(reloaded?.payment.intentId).toBe("pi_via_metadata");
  });

  it("localizar por metadata: orden con OTRO intent -> anomalía, failed, sin transición", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_original" } });

    const event = capturedEvent("pi_de_otra_orden", order._id.toString());
    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
    expect(reloaded?.adminAlertedAt).toBeInstanceOf(Date);
    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("order_not_found");
  });

  it("payment.canceled sobre pending -> cancelled y stock liberado", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_cancel" } });

    const event = canceledEvent("pi_cancel");
    await processPaymentWebhook(event, provider);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.CANCELLED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("payment.canceled sobre una orden ya paid (fuera de orden) -> no-op, sigue paid", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_ya_pagado",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_ya_pagado" } });
    await processPaymentWebhook(capturedEvent("pi_ya_pagado"), provider);

    await processPaymentWebhook(canceledEvent("pi_ya_pagado"), provider);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
  });

  it("payment.failed después de payment.captured (fuera de orden): la orden sigue paid", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_fuera_de_orden",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_fuera_de_orden" } });
    await processPaymentWebhook(capturedEvent("pi_fuera_de_orden"), provider);

    await processPaymentWebhook(failedEvent("pi_fuera_de_orden", { lastError: "Tarjeta rechazada" }), provider);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
  });

  it("OXXO payment.failed con Stripe requires_new_method -> cancelled y stock liberado", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.OXXO);
    const futureExpiry = new Date(Date.now() + 60 * 60_000);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_failed",
        status: "awaiting_customer",
        amountCents: order.totalCents,
        currency: order.currency,
        voucher: { expiresAt: futureExpiry, hostedVoucherUrl: "https://x" },
      }),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_failed",
        status: "requires_new_method",
        amountCents: order.totalCents,
        currency: order.currency,
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    await processPaymentWebhook(failedEvent("pi_oxxo_failed"), provider);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.CANCELLED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("error transitorio (getAuthorization lanza) -> PaymentEvent failed y la función lanza; la reentrega procesa", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    let shouldFail = true;
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockImplementation(async () => {
        if (shouldFail) {
          shouldFail = false;
          throw Object.assign(new Error("No pudimos comunicarnos con el procesador de pagos."), { statusCode: 502 });
        }
        return {
          intentId: "pi_transitorio",
          status: "captured",
          amountCents: order.totalCents,
          currency: order.currency,
        };
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_transitorio" } });

    const event = capturedEvent("pi_transitorio");
    await expect(processPaymentWebhook(event, provider)).rejects.toThrow();

    const afterFirst = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(afterFirst?.status).toBe("failed");
    expect(afterFirst?.attempts).toBe(1);

    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
    const afterSecond = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(afterSecond?.status).toBe("processed");
    expect(afterSecond?.attempts).toBe(2);
  });

  it("una excepción con su propio statusCode (AppError 409 profundo) se relanza como error genérico, nunca con ese statusCode", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      // Simula un AppError de negocio filtrándose desde dentro del
      // despacho (p. ej. una carrera dejando la orden en un estado
      // inesperado) — el orquestador NUNCA debe dejar que este statusCode
      // llegue al controller: el contrato es 500 siempre en fallo
      // transitorio, para que Stripe reintente.
      getAuthorization: vi.fn().mockRejectedValue(new AppError("Conflicto interno inesperado.", 409)),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_deep_conflict" } });

    const event = capturedEvent("pi_deep_conflict");
    await expect(processPaymentWebhook(event, provider)).rejects.not.toBeInstanceOf(AppError);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
  });

  async function createPaidOrder() {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_refund_target",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    await Order.updateOne({ _id: order._id }, { $set: { "payment.intentId": "pi_refund_target" } });
    await processPaymentWebhook(capturedEvent("pi_refund_target"), provider);
    const paid = await Order.findById(order._id);
    return { order: paid!, provider, variantId };
  }

  it("payment.refunded total -> refunded + onHand restaurado", async () => {
    const { order, provider, variantId } = await createPaidOrder();

    const event = refundedEvent("pi_refund_target", { amountRefundedCents: order.totalCents });
    await processPaymentWebhook(event, provider);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.REFUNDED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(10);
    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
  });

  it("payment.refunded sin orden que tenga ese intentId -> PaymentEvent failed 'order_not_found'", async () => {
    const provider = buildFakePaymentProvider();
    const event = refundedEvent("pi_sin_orden_refund", { amountRefundedCents: 1000 });

    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("order_not_found");
  });

  it("payment.refunded con moneda distinta -> anomalía, PaymentEvent failed, sin transición", async () => {
    const { order, provider } = await createPaidOrder();

    const event = refundedEvent("pi_refund_target", { amountRefundedCents: order.totalCents, currency: "usd" });
    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("amount_anomaly");
  });

  it("refund.failed desmarca refundRequestedAt y alerta", async () => {
    const { order, provider } = await createPaidOrder();
    await Order.updateOne({ _id: order._id }, { $set: { "payment.refundRequestedAt": new Date() } });

    const event = refundFailedEvent("pi_refund_target", { reason: "insufficient_funds" });
    await processPaymentWebhook(event, provider);

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.payment.refundRequestedAt).toBeUndefined();
    expect(reloaded?.adminAlertedAt).toBeInstanceOf(Date);
    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
  });

  it("refund.failed sin orden que tenga ese intentId -> PaymentEvent failed 'order_not_found'", async () => {
    const provider = buildFakePaymentProvider();
    const event = refundFailedEvent("pi_sin_orden_refund_failed");

    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("order_not_found");
  });

  it("dispute.opened -> disputeStatus:open, PaymentEvent processed", async () => {
    const { order, provider } = await createPaidOrder();

    const event = disputeOpenedEvent("pi_refund_target");
    await processPaymentWebhook(event, provider);

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.disputeStatus).toBe("open");
    expect(reloaded?.status).toBe(OrderStatus.PAID);
    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
  });

  it("dispute.closed(lost) -> disputeStatus:lost, status de la orden intacto", async () => {
    const { order, provider } = await createPaidOrder();
    await processPaymentWebhook(disputeOpenedEvent("pi_refund_target"), provider);

    const event = disputeClosedEvent("pi_refund_target", "lost");
    await processPaymentWebhook(event, provider);

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.disputeStatus).toBe("lost");
    expect(reloaded?.status).toBe(OrderStatus.PAID);
  });

  it("dispute.opened sin orden que tenga ese intentId -> PaymentEvent failed 'order_not_found'", async () => {
    const provider = buildFakePaymentProvider();
    const event = disputeOpenedEvent("pi_sin_orden_dispute");

    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("order_not_found");
  });
});
