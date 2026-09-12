import { OrderStatus, PaymentMethod, PaymentState, ShippingCarrier } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { changeOrderStatus } from "../../src/services/order-admin-status.service.js";
import { applyProviderRefund, recordRefundFailure } from "../../src/services/order-refund-settlement.service.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `applyProviderRefund` — aplica lo que Stripe YA confirmó (`charge.refunded`)
 * a la orden: transición a `refunded` + restock solo si aún no se envió
 * (decisión 3 del plan de 1.6), o solo el monto si es parcial. `$max` en
 * `refundedAmountCents` para que un evento viejo/fuera de orden nunca pise
 * un monto mayor ya aplicado (decisión 6).
 */
describe("services/order-refund-settlement", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function seedOrderAtStatus(target: OrderStatus) {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const adminId = randomUserId();
    await User.create({
      _id: adminId,
      email: `${adminId}@example.com`,
      password: "P4ssword!!",
      firstName: "Admin",
      lastName: "Glow",
      role: "admin",
      emailVerified: true,
    });

    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: PaymentMethod.CARD });
    const { order: created } = await createOrder(input);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(created._id.toString(), userId, { provider });
    await markOrderPaid({ orderId: created._id.toString() });

    if (target === OrderStatus.PROCESSING || target === OrderStatus.SHIPPED) {
      await changeOrderStatus({ orderId: created._id.toString(), targetStatus: OrderStatus.PROCESSING, adminId });
    }
    if (target === OrderStatus.SHIPPED) {
      await changeOrderStatus({
        orderId: created._id.toString(),
        targetStatus: OrderStatus.SHIPPED,
        adminId,
        shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "TRACK1" },
      });
    }

    const order = await Order.findById(created._id);
    return { order: order!, variantId, adminId };
  }

  it("total desde processing -> refunded + onHand restaurado", async () => {
    const { order, variantId } = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const inventoryBefore = await Inventory.findOne({ variantId }).lean();

    const result = await applyProviderRefund(order._id.toString(), {
      amountRefundedCents: order.totalCents,
      currency: "mxn",
    });

    expect(result.outcome).toBe("refunded");
    expect(result.transitioned).toBe(true);
    expect(result.order!.status).toBe(OrderStatus.REFUNDED);
    expect(result.order!.payment.state).toBe(PaymentState.REFUNDED);
    expect(result.order!.payment.refundedAmountCents).toBe(order.totalCents);

    const inventoryAfter = await Inventory.findOne({ variantId }).lean();
    expect(inventoryAfter!.onHand).toBe(inventoryBefore!.onHand + 2);
  });

  it("total desde shipped -> refunded, onHand intacto (sin restock automático)", async () => {
    const { order, variantId } = await seedOrderAtStatus(OrderStatus.SHIPPED);
    const inventoryBefore = await Inventory.findOne({ variantId }).lean();

    const result = await applyProviderRefund(order._id.toString(), {
      amountRefundedCents: order.totalCents,
      currency: "mxn",
    });

    expect(result.outcome).toBe("refunded");
    expect(result.transitioned).toBe(true);
    expect(result.order!.status).toBe(OrderStatus.REFUNDED);
    expect(result.restock).toBeUndefined();

    const inventoryAfter = await Inventory.findOne({ variantId }).lean();
    expect(inventoryAfter!.onHand).toBe(inventoryBefore!.onHand);
  });

  it("parcial: solo guarda el monto, sin cambio de status", async () => {
    const { order } = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const partialAmount = Math.floor(order.totalCents / 2);

    const result = await applyProviderRefund(order._id.toString(), { amountRefundedCents: partialAmount, currency: "mxn" });

    expect(result.outcome).toBe("partial");
    expect(result.transitioned).toBe(false);
    expect(result.order!.status).toBe(OrderStatus.PROCESSING);
    expect(result.order!.payment.refundedAmountCents).toBe(partialAmount);
  });

  it("charge.refunded duplicado (mismo monto total dos veces) -> un solo restock", async () => {
    const { order, variantId } = await seedOrderAtStatus(OrderStatus.PROCESSING);

    const first = await applyProviderRefund(order._id.toString(), { amountRefundedCents: order.totalCents, currency: "mxn" });
    const inventoryAfterFirst = await Inventory.findOne({ variantId }).lean();

    const second = await applyProviderRefund(order._id.toString(), { amountRefundedCents: order.totalCents, currency: "mxn" });
    const inventoryAfterSecond = await Inventory.findOne({ variantId }).lean();

    expect(first.transitioned).toBe(true);
    expect(second.transitioned).toBe(false);
    expect(second.outcome).toBe("refunded");
    expect(inventoryAfterSecond!.onHand).toBe(inventoryAfterFirst!.onHand);
  });

  it("monto menor que llega tarde no pisa un monto mayor ya aplicado ($max)", async () => {
    const { order } = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const bigAmount = Math.floor((order.totalCents * 3) / 4);
    const smallAmount = Math.floor(order.totalCents / 4);

    await applyProviderRefund(order._id.toString(), { amountRefundedCents: bigAmount, currency: "mxn" });
    const stale = await applyProviderRefund(order._id.toString(), { amountRefundedCents: smallAmount, currency: "mxn" });

    expect(stale.order!.payment.refundedAmountCents).toBe(bigAmount);
  });

  it("moneda distinta -> amount_anomaly, sella adminAlertedAt, sin cambios", async () => {
    const { order } = await seedOrderAtStatus(OrderStatus.PROCESSING);

    const result = await applyProviderRefund(order._id.toString(), { amountRefundedCents: order.totalCents, currency: "usd" });

    expect(result.outcome).toBe("amount_anomaly");
    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded!.status).toBe(OrderStatus.PROCESSING);
    expect(reloaded!.adminAlertedAt).toBeInstanceOf(Date);
    expect(reloaded!.payment.refundedAmountCents).toBeUndefined();
  });

  it("monto mayor al total -> amount_anomaly", async () => {
    const { order } = await seedOrderAtStatus(OrderStatus.PROCESSING);

    const result = await applyProviderRefund(order._id.toString(), {
      amountRefundedCents: order.totalCents + 100,
      currency: "mxn",
    });

    expect(result.outcome).toBe("amount_anomaly");
  });

  it("🔀 dos charge.refunded concurrentes por el monto total -> una sola transición y un solo restock", async () => {
    const { order, variantId } = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const inventoryBefore = await Inventory.findOne({ variantId }).lean();

    const [a, b] = await Promise.all([
      applyProviderRefund(order._id.toString(), { amountRefundedCents: order.totalCents, currency: "mxn" }),
      applyProviderRefund(order._id.toString(), { amountRefundedCents: order.totalCents, currency: "mxn" }),
    ]);

    const transitionedCount = [a, b].filter((r) => r.transitioned).length;
    expect(transitionedCount).toBe(1);

    const inventoryAfter = await Inventory.findOne({ variantId }).lean();
    expect(inventoryAfter!.onHand).toBe(inventoryBefore!.onHand + 2);

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded!.status).toBe(OrderStatus.REFUNDED);
  });
});

describe("services/order-refund-settlement — recordRefundFailure", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function seedProcessingOrderWithRefundRequested() {
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
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: PaymentMethod.CARD });
    const { order: created } = await createOrder(input);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(created._id.toString(), userId, { provider });
    await markOrderPaid({ orderId: created._id.toString() });
    await Order.updateOne({ _id: created._id }, { $set: { "payment.refundRequestedAt": new Date() } });
    return created._id.toString();
  }

  it("desmarca refundRequestedAt y sella adminAlertedAt", async () => {
    const orderId = await seedProcessingOrderWithRefundRequested();

    await recordRefundFailure(orderId, { refundId: "re_1", reason: "insufficient_funds" });

    const reloaded = await Order.findById(orderId).lean();
    expect(reloaded!.payment.refundRequestedAt).toBeUndefined();
    expect(reloaded!.adminAlertedAt).toBeInstanceOf(Date);
  });

  it("con requestedAtMs: solo desmarca si coincide con el refundRequestedAt actual (fencing) — una notificación tardía de un intento viejo no libera el mutex de uno nuevo", async () => {
    const orderId = await seedProcessingOrderWithRefundRequested();
    const staleAttempt = new Date(Date.now() - 60 * 60_000); // el intento viejo, ya fallido
    const currentAttempt = new Date(); // el intento NUEVO, actualmente en vuelo
    await Order.updateOne({ _id: orderId }, { $set: { "payment.refundRequestedAt": currentAttempt } });

    // `refund.failed` tardío del intento VIEJO — no debe tocar el mutex del nuevo.
    await recordRefundFailure(orderId, { refundId: "re_stale", requestedAtMs: staleAttempt.getTime() });
    const afterStale = await Order.findById(orderId).lean();
    expect(afterStale!.payment.refundRequestedAt?.getTime()).toBe(currentAttempt.getTime());

    // `refund.failed` del intento ACTUAL — sí debe liberarlo.
    await recordRefundFailure(orderId, { refundId: "re_current", requestedAtMs: currentAttempt.getTime() });
    const afterCurrent = await Order.findById(orderId).lean();
    expect(afterCurrent!.payment.refundRequestedAt).toBeUndefined();
  });

  it("sobre una orden ya refunded: solo alerta, sin tocar el status", async () => {
    const orderId = await seedProcessingOrderWithRefundRequested();
    await applyProviderRefund(orderId, {
      amountRefundedCents: (await Order.findById(orderId))!.totalCents,
      currency: "mxn",
    });

    await recordRefundFailure(orderId, { refundId: "re_2" });

    const reloaded = await Order.findById(orderId).lean();
    expect(reloaded!.status).toBe(OrderStatus.REFUNDED);
    expect(reloaded!.adminAlertedAt).toBeInstanceOf(Date);
  });
});
