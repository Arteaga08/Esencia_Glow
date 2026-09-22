import { OrderStatus, ShippingLabelStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { releaseReservationDetailed } from "../../src/services/stock-reservation.service.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

/**
 * La guía de envío se encola EXACTAMENTE cuando el pago se confirma (1.9):
 * `label.status = pending` viaja en la misma transacción que `pending -> paid`
 * — nunca antes del pago, y nunca para un pago con anomalía.
 */
describe("services/order-payment — encolado de la guía al pagar", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createPendingOrder() {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const { order } = await createOrder(await buildCreateOrderInput(userId, lines));
    return order;
  }

  it("una orden recién creada (pending) NO tiene guía", async () => {
    const order = await createPendingOrder();
    const stored = await Order.findById(order._id).lean();
    expect(stored!.status).toBe(OrderStatus.PENDING);
    expect(stored!.label).toBeUndefined();
  });

  it("al pagarse queda con label pending, 0 intentos y nextAttemptAt puesto", async () => {
    const order = await createPendingOrder();
    const before = Date.now();

    await markOrderPaid({ orderId: order._id.toString() });

    const stored = await Order.findById(order._id).lean();
    expect(stored!.status).toBe(OrderStatus.PAID);
    expect(stored!.label!.status).toBe(ShippingLabelStatus.PENDING);
    expect(stored!.label!.attempts).toBe(0);
    expect(stored!.label!.nextAttemptAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("un reintento del webhook (already_paid) NO reinicia una guía que ya avanzó", async () => {
    const order = await createPendingOrder();
    await markOrderPaid({ orderId: order._id.toString() });
    await Order.updateOne(
      { _id: order._id },
      { $set: { "label.status": ShippingLabelStatus.READY, "label.attempts": 1, "label.trackingNumber": "TRK-1" } },
    );

    const second = await markOrderPaid({ orderId: order._id.toString() });

    expect(second.outcome).toBe("already_paid");
    const stored = await Order.findById(order._id).lean();
    expect(stored!.label!.status).toBe(ShippingLabelStatus.READY);
    expect(stored!.label!.trackingNumber).toBe("TRK-1");
  });

  it("con inventory_incident (reserva ya liberada) la orden queda paid pero SIN guía encolada", async () => {
    const order = await createPendingOrder();
    await releaseReservationDetailed(order.reservationId.toString());

    const result = await markOrderPaid({ orderId: order._id.toString() });

    expect(result.outcome).toBe("inventory_incident");
    const stored = await Order.findById(order._id).lean();
    expect(stored!.status).toBe(OrderStatus.PAID);
    expect(stored!.label).toBeUndefined();
  });
});
