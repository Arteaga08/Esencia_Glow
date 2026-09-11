import { OrderStatus, PaymentMethod } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { closePendingOrder } from "../../src/services/order-closing.service.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";
import { User } from "../../src/models/user.model.js";

/**
 * `closePendingOrder` — único camino para cerrar un pedido `pending`
 * (§D del plan de 1.6): consulta/cancela primero en Stripe ("Stripe-first")
 * antes de liberar inventario, para nunca cancelar un pedido cuyo pago ya
 * se procesó del lado del proveedor.
 */
describe("services/order-closing — closePendingOrder", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createPendingOrder(method: PaymentMethod) {
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
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: method });
    const { order } = await createOrder(input);
    return { order, userId, variantId };
  }

  it("sin intent (nunca se llamó a ensurePaymentIntent): cierra y libera stock", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();

    const result = await closePendingOrder(order._id.toString(), "customer", { userId, provider });

    expect(result.outcome).toBe("closed");
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.CANCELLED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("tarjeta con intent: Stripe cancela limpio -> cierra y libera", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    const result = await closePendingOrder(order._id.toString(), "customer", { userId, provider });

    expect(result.outcome).toBe("closed");
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("tarjeta con intent: Stripe dice already_captured -> liquida en vez de cancelar, nunca cancelled", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      cancel: vi.fn().mockResolvedValue("already_captured"),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_x",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
        card: { brand: "visa", last4: "1111" },
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    const result = await closePendingOrder(order._id.toString(), "customer", { userId, provider });

    expect(result.outcome).toBe("already_paid");
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
  });

  it("OXXO con ficha vigente: 409, la orden sigue pending", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.OXXO);
    const futureExpiry = new Date(Date.now() + 60 * 60_000);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        voucher: { expiresAt: futureExpiry, hostedVoucherUrl: "https://x" },
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    await expect(
      closePendingOrder(order._id.toString(), "customer", { userId, provider }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
  });

  it("OXXO con ficha vencida y Stripe SIN captura: cierra y libera stock", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.OXXO);
    const pastExpiry = new Date(Date.now() - 60_000);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo2",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        voucher: { expiresAt: pastExpiry, hostedVoucherUrl: "https://x" },
      }),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo2",
        status: "requires_new_method",
        amountCents: 100000,
        currency: "mxn",
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    const result = await closePendingOrder(order._id.toString(), "customer", { userId, provider });

    expect(result.outcome).toBe("closed");
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("OXXO con ficha vencida pero Stripe SÍ capturó: liquida a paid", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.OXXO);
    const pastExpiry = new Date(Date.now() - 60_000);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo3",
        status: "awaiting_customer",
        amountCents: order.totalCents,
        currency: order.currency,
        voucher: { expiresAt: pastExpiry, hostedVoucherUrl: "https://x" },
      }),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo3",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    const result = await closePendingOrder(order._id.toString(), "customer", { userId, provider });

    expect(result.outcome).toBe("already_paid");
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
  });

  it("tarjeta con intent: already_captured pero el monto no cuadra -> payment_anomaly (NO already_paid), sigue pending", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      cancel: vi.fn().mockResolvedValue("already_captured"),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_mismatch",
        status: "captured",
        amountCents: order.totalCents + 100,
        currency: order.currency,
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    const result = await closePendingOrder(order._id.toString(), "customer", { userId, provider });

    expect(result.outcome).toBe("payment_anomaly");
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
    expect(reloaded?.adminAlertedAt).toBeInstanceOf(Date);
  });

  it("un pedido ajeno responde 404 (anti-IDOR)", async () => {
    const { order } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();

    await expect(
      closePendingOrder(order._id.toString(), "customer", { userId: randomUserId(), provider }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("admin cierra un pendiente con intent de tarjeta: Stripe-first y actorId queda en statusHistory", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    const adminId = randomUserId();

    const result = await closePendingOrder(order._id.toString(), "admin", {
      actorId: adminId,
      reason: "Cliente pidió cancelar por soporte",
      provider,
    });

    expect(result.outcome).toBe("closed");
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    const reloaded = await Order.findById(order._id);
    const lastEntry = reloaded!.statusHistory[reloaded!.statusHistory.length - 1]!;
    expect(lastEntry.actorId?.toString()).toBe(adminId);
  });

  it("OXXO antes de expiresAt, cerrado por 'system' (webhook payment_failed) con Stripe requires_new_method: cierra y libera", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.OXXO);
    const futureExpiry = new Date(Date.now() + 60 * 60_000);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_sys",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        voucher: { expiresAt: futureExpiry, hostedVoucherUrl: "https://x" },
      }),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_sys",
        status: "requires_new_method",
        amountCents: 100000,
        currency: "mxn",
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    const result = await closePendingOrder(order._id.toString(), "system", {
      reason: "La ficha OXXO venció sin pago.",
      provider,
    });

    expect(result.outcome).toBe("closed");
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.CANCELLED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("OXXO antes de expiresAt, cerrado por 'system' con Stripe awaiting_customer (transitorio): 409, sigue pending", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.OXXO);
    const futureExpiry = new Date(Date.now() + 60 * 60_000);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_sys2",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        voucher: { expiresAt: futureExpiry, hostedVoucherUrl: "https://x" },
      }),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_sys2",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
      }),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    await expect(
      closePendingOrder(order._id.toString(), "system", { reason: "x", provider }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
  });

  it("tarjeta con intent: Stripe dice not_cancelable (PI en estado intermedio) -> NO cancela ni libera stock, marca para revisión", async () => {
    const { order, userId, variantId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      cancel: vi.fn().mockResolvedValue("not_cancelable"),
    });
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    await expect(
      closePendingOrder(order._id.toString(), "customer", { userId, provider }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
    expect(reloaded?.adminAlertedAt).toBeInstanceOf(Date);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(2);
  });
});
