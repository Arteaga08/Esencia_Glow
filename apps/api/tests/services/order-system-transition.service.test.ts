import { DisputeStatus, OrderStatus, ShippingCarrier } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Order } from "../../src/models/order.model.js";
import { applySystemOrderTransition } from "../../src/services/order-system-transition.service.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { seedPaidOrder } from "../helpers/paid-order-fixtures.js";

const SHIPMENT = {
  carrier: ShippingCarrier.FEDEX,
  trackingNumber: "TRK-123",
  trackingUrl: "https://carrier.example/track/TRK-123",
};

/**
 * Transiciones automáticas (1.9): la guía lista mueve `paid -> processing`,
 * el tracking mueve `processing -> shipped` y `shipped -> delivered`. Mismo
 * CAS que el panel admin, pero con actor `system` y sin lanzar cuando la
 * orden ya no está donde se esperaba (una carrera legítima, no un error).
 */
describe("services/order-system-transition", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("paid -> processing como system: aplica, historia con actorType 'system' y sin actorId", async () => {
    const { orderId } = await seedPaidOrder();

    const result = await applySystemOrderTransition({
      orderId,
      from: OrderStatus.PAID,
      to: OrderStatus.PROCESSING,
      reason: "Guía generada",
    });

    expect(result.outcome).toBe("applied");
    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe(OrderStatus.PROCESSING);
    const last = order!.statusHistory.at(-1)!;
    expect(last.status).toBe(OrderStatus.PROCESSING);
    expect(last.actorType).toBe("system");
    expect(last.actorId).toBeUndefined();
    expect(last.reason).toBe("Guía generada");
  });

  it("audita la transición con actor 'system' y sin actorId", async () => {
    const { orderId } = await seedPaidOrder();

    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    const audit = await AuditLog.findOne({ action: "order_status_changed", targetId: orderId }).lean();
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBeUndefined();
    expect(audit!.metadata).toMatchObject({ from: "paid", to: "processing", actor: "system" });
  });

  it("processing -> shipped con guía: sella shipment con shippedAt", async () => {
    const { orderId } = await seedPaidOrder();
    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    const result = await applySystemOrderTransition({
      orderId,
      from: OrderStatus.PROCESSING,
      to: OrderStatus.SHIPPED,
      shipment: SHIPMENT,
    });

    expect(result.outcome).toBe("applied");
    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe(OrderStatus.SHIPPED);
    expect(order!.shipment).toMatchObject(SHIPMENT);
    expect(order!.shipment!.shippedAt).toBeInstanceOf(Date);
  });

  it("processing -> shipped SIN guía es un error de programación: 400, orden intacta", async () => {
    const { orderId } = await seedPaidOrder();
    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    await expect(
      applySystemOrderTransition({ orderId, from: OrderStatus.PROCESSING, to: OrderStatus.SHIPPED }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PROCESSING);
  });

  it("shipped -> delivered aplica", async () => {
    const { orderId } = await seedPaidOrder();
    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });
    await applySystemOrderTransition({ orderId, from: OrderStatus.PROCESSING, to: OrderStatus.SHIPPED, shipment: SHIPMENT });

    const result = await applySystemOrderTransition({ orderId, from: OrderStatus.SHIPPED, to: OrderStatus.DELIVERED });

    expect(result.outcome).toBe("applied");
    expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.DELIVERED);
  });

  it("si la orden ya no está en `from` (otro escritor la movió) => skipped_state, sin tocar nada", async () => {
    const { orderId } = await seedPaidOrder();
    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });
    const before = await Order.findById(orderId).lean();

    const result = await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    expect(result.outcome).toBe("skipped_state");
    const after = await Order.findById(orderId).lean();
    expect(after!.statusHistory).toHaveLength(before!.statusHistory.length);
  });

  it("una orden inexistente => 404", async () => {
    await expect(
      applySystemOrderTransition({
        orderId: "64b7f0c2a1b2c3d4e5f60718",
        from: OrderStatus.PAID,
        to: OrderStatus.PROCESSING,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("una arista que el sistema NO puede tomar (paid -> delivered) lanza 409", async () => {
    const { orderId } = await seedPaidOrder();
    await expect(
      applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.DELIVERED }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("con contracargo abierto, paid -> processing se OMITE (skipped_dispute), no lanza ni mueve nada", async () => {
    const { orderId } = await seedPaidOrder();
    await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });

    const result = await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    expect(result.outcome).toBe("skipped_dispute");
    expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PAID);
  });

  it("con contracargo abierto, processing -> shipped también se omite", async () => {
    const { orderId } = await seedPaidOrder();
    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });
    await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });

    const result = await applySystemOrderTransition({
      orderId,
      from: OrderStatus.PROCESSING,
      to: OrderStatus.SHIPPED,
      shipment: SHIPMENT,
    });

    expect(result.outcome).toBe("skipped_dispute");
    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe(OrderStatus.PROCESSING);
    expect(order!.shipment).toBeUndefined();
  });

  it("con contracargo abierto, shipped -> delivered SÍ se aplica (el guard solo bloquea despachar)", async () => {
    const { orderId } = await seedPaidOrder();
    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });
    await applySystemOrderTransition({ orderId, from: OrderStatus.PROCESSING, to: OrderStatus.SHIPPED, shipment: SHIPMENT });
    await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });

    const result = await applySystemOrderTransition({ orderId, from: OrderStatus.SHIPPED, to: OrderStatus.DELIVERED });

    expect(result.outcome).toBe("applied");
  });

  it("dos aplicaciones concurrentes de la misma transición: exactamente UNA aplica, la otra es skipped_state", async () => {
    const { orderId } = await seedPaidOrder();

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING }),
      ),
    );

    expect(results.filter((r) => r.outcome === "applied")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "skipped_state")).toHaveLength(5);
    const order = await Order.findById(orderId).lean();
    expect(order!.statusHistory.filter((h) => h.status === OrderStatus.PROCESSING)).toHaveLength(1);
  });
});
