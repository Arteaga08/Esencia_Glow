import { OrderStatus, ShipmentTrackingStatus, ShippingCarrier, ShippingLabelStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { listAdminShipments } from "../../src/services/shipment-panel.service.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { seedPaidOrder } from "../helpers/paid-order-fixtures.js";

/**
 * Read model de `/admin/shipments` (Milestone 2.4) — calcado de
 * `order-admin.service.ts`: cuatro colas DISJUNTAS por construcción sobre
 * `status`/`label.status`/`tracking.status`, nunca un tercer eje de
 * agrupación mezclado con `?group=` (ese sigue siendo exclusivo de Pedidos).
 */

async function seed(overrides: {
  status?: OrderStatus;
  label?: Record<string, unknown>;
  tracking?: Record<string, unknown>;
} = {}) {
  const seeded = await seedPaidOrder();
  const set: Record<string, unknown> = {};
  if (overrides.status) set.status = overrides.status;
  if (overrides.label) set.label = overrides.label;
  if (overrides.tracking) set.tracking = overrides.tracking;
  if (Object.keys(set).length > 0) {
    await Order.updateOne({ _id: seeded.orderId }, { $set: set });
  }
  return seeded;
}

const baseQuery = { page: 1, limit: 20, sort: { field: "createdAt", direction: "desc" as const } };

describe("services/shipment-panel — colas", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });


  it("una guía en needs_review cae en problems, no en preparing", async () => {
    const { orderId } = await seed({
      status: OrderStatus.PAID,
      label: { status: ShippingLabelStatus.NEEDS_REVIEW, attempts: 3 },
    });

    const problems = await listAdminShipments({ ...baseQuery, queue: "problems" });
    const preparing = await listAdminShipments({ ...baseQuery, queue: "preparing" });

    expect(problems.rows.map((r) => r.id)).toContain(orderId);
    expect(preparing.rows.map((r) => r.id)).not.toContain(orderId);
  });

  it("un pedido shipped con rastreo en exception cae en problems, no en transit", async () => {
    const { orderId } = await seed({
      status: OrderStatus.SHIPPED,
      tracking: { status: ShipmentTrackingStatus.EXCEPTION, lastEventAt: new Date() },
    });

    const problems = await listAdminShipments({ ...baseQuery, queue: "problems" });
    const transit = await listAdminShipments({ ...baseQuery, queue: "transit" });

    expect(problems.rows.map((r) => r.id)).toContain(orderId);
    expect(transit.rows.map((r) => r.id)).not.toContain(orderId);
  });

  it("una orden pagada sin guía cae en preparing", async () => {
    const { orderId } = await seed({ status: OrderStatus.PAID });

    const { rows } = await listAdminShipments({ ...baseQuery, queue: "preparing" });

    expect(rows.map((r) => r.id)).toContain(orderId);
  });

  it("shipped sin incidencias cae en transit; delivered sin incidencias cae en delivered", async () => {
    const { orderId: shippedId } = await seed({
      status: OrderStatus.SHIPPED,
      tracking: { status: ShipmentTrackingStatus.IN_TRANSIT, lastEventAt: new Date() },
    });
    const { orderId: deliveredId } = await seed({
      status: OrderStatus.DELIVERED,
      tracking: { status: ShipmentTrackingStatus.DELIVERED, lastEventAt: new Date() },
    });

    const transit = await listAdminShipments({ ...baseQuery, queue: "transit" });
    const delivered = await listAdminShipments({ ...baseQuery, queue: "delivered" });

    expect(transit.rows.map((r) => r.id)).toContain(shippedId);
    expect(delivered.rows.map((r) => r.id)).toContain(deliveredId);
    expect(transit.rows.map((r) => r.id)).not.toContain(deliveredId);
    expect(delivered.rows.map((r) => r.id)).not.toContain(shippedId);
  });

  it("una orden pending no aparece en ninguna cola", async () => {
    const { orderId } = await seed({ status: OrderStatus.PENDING });

    for (const queue of ["problems", "preparing", "transit", "delivered"] as const) {
      const { rows } = await listAdminShipments({ ...baseQuery, queue });
      expect(rows.map((r) => r.id)).not.toContain(orderId);
    }
  });

  it("busca por número de guía", async () => {
    const { orderId } = await seed({
      status: OrderStatus.SHIPPED,
      label: {
        status: ShippingLabelStatus.READY,
        attempts: 1,
        carrier: ShippingCarrier.FEDEX,
        trackingNumber: "FX-999000111",
      },
    });

    const { rows } = await listAdminShipments({ ...baseQuery, queue: "transit", search: "FX-999000111" });

    expect(rows.map((r) => r.id)).toEqual([orderId]);
  });

  it("busca por número de pedido", async () => {
    const { orderId } = await seed({ status: OrderStatus.PAID });
    const order = await Order.findById(orderId).lean();

    const { rows } = await listAdminShipments({ ...baseQuery, queue: "preparing", search: order!.orderNumber });

    expect(rows.map((r) => r.id)).toEqual([orderId]);
  });

  it("pagina con meta.total correcto", async () => {
    await seed({ status: OrderStatus.PAID });
    await seed({ status: OrderStatus.PAID });

    const { meta } = await listAdminShipments({ ...baseQuery, queue: "preparing", limit: 1 });

    expect(meta.total).toBe(2);
    expect(meta.pages).toBe(2);
  });
});
