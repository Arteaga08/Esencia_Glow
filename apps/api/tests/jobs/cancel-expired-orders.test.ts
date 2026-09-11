import { OrderStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { cancelExpiredOrders } from "../../src/jobs/cancel-expired-orders.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

describe("jobs/cancelExpiredOrders", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createExpiredPendingOrder(onHand = 10) {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand });
    const userId = randomUserId();
    const input = await buildCreateOrderInput(userId, [
      { itemType: "product", itemId: variantId.toString(), quantity: 1 },
    ]);
    const { order } = await createOrder(input);
    await Order.updateOne({ _id: order._id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
    return { order, variantId };
  }

  it("cancela una orden pending cuya reserva ya venció y libera el stock", async () => {
    const { order, variantId } = await createExpiredPendingOrder();

    const summary = await cancelExpiredOrders();

    expect(summary.cancelled).toBe(1);
    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.CANCELLED);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("no toca una orden pending que no ha vencido", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const input = await buildCreateOrderInput(userId, [
      { itemType: "product", itemId: variantId.toString(), quantity: 1 },
    ]);
    await createOrder(input);

    const summary = await cancelExpiredOrders();
    expect(summary.cancelled).toBe(0);
  });

  it("una orden ya paid no se cancela aunque su expiresAt viejo siga ahí", async () => {
    const { order } = await createExpiredPendingOrder();
    await Order.updateOne({ _id: order._id }, { $set: { status: OrderStatus.PENDING } });
    await markOrderPaid({ orderId: order._id.toString() });
    // markOrderPaid no toca expiresAt, así que el filtro por status ya lo excluye.

    const summary = await cancelExpiredOrders();
    expect(summary.cancelled).toBe(0);
    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.PAID);
  });

  it("🔀 dos corridas concurrentes sobre la misma orden vencida producen UNA sola cancelación y UN solo release", async () => {
    const { order, variantId } = await createExpiredPendingOrder();

    const [first, second] = await Promise.all([cancelExpiredOrders(), cancelExpiredOrders()]);

    expect(first.cancelled + second.cancelled).toBe(1);
    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.CANCELLED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });
});
