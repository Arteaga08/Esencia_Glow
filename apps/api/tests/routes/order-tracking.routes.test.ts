import { OrderStatus, ShipmentTrackingStatus as S, ShippingCarrier, ShippingLabelStatus } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Order } from "../../src/models/order.model.js";
import { ShipmentTrackingEvent } from "../../src/models/shipment-tracking-event.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { seedPaidOrder } from "../helpers/paid-order-fixtures.js";

const app = buildApp();
const at = (minutes: number) => new Date(Date.UTC(2026, 8, 21, 10, minutes));

describe("routes — rastreo del pedido", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function seedTrackedOrder(customer: { userId: string }) {
    const { orderId } = await seedPaidOrder();
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          userId: customer.userId,
          status: OrderStatus.SHIPPED,
          shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "TRK-1", trackingUrl: "https://track.example/1", shippedAt: at(0) },
          tracking: { status: S.IN_TRANSIT, lastEventAt: at(20) },
        },
      },
    );
    // Insertados FUERA de orden a propósito: la respuesta debe ordenarlos por occurredAt.
    await ShipmentTrackingEvent.insertMany([
      { orderId, provider: "skydropx", providerEventId: "e3", status: S.IN_TRANSIT, occurredAt: at(20), description: "En tránsito", location: "Guadalajara, JAL" },
      { orderId, provider: "skydropx", providerEventId: "e1", status: S.LABEL_CREATED, occurredAt: at(0) },
      { orderId, provider: "skydropx", providerEventId: "e2", status: S.PICKED_UP, occurredAt: at(10) },
    ]);
    return orderId;
  }

  describe("GET /orders/:id/tracking (clienta)", () => {
    it("401 sin sesión", async () => {
      const res = await request(app).get("/api/v1/orders/64b7f0c2a1b2c3d4e5f60718/tracking");
      expect(res.status).toBe(401);
    });

    it("devuelve estado, guía y eventos ordenados por occurredAt", async () => {
      const { agent, userId } = await createCustomerSession(app);
      const orderId = await seedTrackedOrder({ userId });

      const res = await agent.get(`/api/v1/orders/${orderId}/tracking`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        status: "in_transit",
        carrier: "fedex",
        trackingNumber: "TRK-1",
        trackingUrl: "https://track.example/1",
        events: [
          { status: "label_created", occurredAt: at(0).toISOString() },
          { status: "picked_up", occurredAt: at(10).toISOString() },
          { status: "in_transit", occurredAt: at(20).toISOString(), description: "En tránsito", location: "Guadalajara, JAL" },
        ],
      });
    });

    it("NO expone el proveedor ni el id de evento a la clienta", async () => {
      const { agent, userId } = await createCustomerSession(app);
      const orderId = await seedTrackedOrder({ userId });

      const res = await agent.get(`/api/v1/orders/${orderId}/tracking`);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain("providerEventId");
      expect(body).not.toContain("skydropx");
    });

    it("antes de que salga el paquete, la guía sale de la etiqueta ya generada", async () => {
      const { agent, userId } = await createCustomerSession(app);
      const { orderId } = await seedPaidOrder();
      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            userId,
            label: { status: ShippingLabelStatus.READY, attempts: 1, trackingNumber: "TRK-LBL", carrier: ShippingCarrier.DHL, trackingUrl: "https://track.example/lbl" },
          },
        },
      );

      const res = await agent.get(`/api/v1/orders/${orderId}/tracking`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ carrier: "dhl", trackingNumber: "TRK-LBL", trackingUrl: "https://track.example/lbl", events: [] });
    });

    it("una orden sin guía ni eventos responde 200 con events vacío y sin status", async () => {
      const { agent, userId } = await createCustomerSession(app);
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $set: { userId }, $unset: { label: "" } });

      const res = await agent.get(`/api/v1/orders/${orderId}/tracking`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ events: [] });
    });

    it("anti-IDOR: el pedido de OTRA clienta responde 404 (no 403, no confirma que existe)", async () => {
      const owner = await createCustomerSession(app);
      const orderId = await seedTrackedOrder({ userId: owner.userId });
      const intruder = await createCustomerSession(app);

      const res = await intruder.agent.get(`/api/v1/orders/${orderId}/tracking`);

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("TRK-1");
    });

    it("id inválido 400 y pedido inexistente 404", async () => {
      const { agent } = await createCustomerSession(app);
      expect((await agent.get("/api/v1/orders/no-es-id/tracking")).status).toBe(400);
      expect((await agent.get("/api/v1/orders/64b7f0c2a1b2c3d4e5f60718/tracking")).status).toBe(404);
    });

    it("acota la respuesta a 200 eventos", async () => {
      const { agent, userId } = await createCustomerSession(app);
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $set: { userId } });
      await ShipmentTrackingEvent.insertMany(
        Array.from({ length: 205 }, (_, i) => ({
          orderId,
          provider: "stub" as const,
          providerEventId: `bulk-${i}`,
          status: S.IN_TRANSIT,
          occurredAt: new Date(Date.UTC(2026, 8, 21, 0, 0, i)),
        })),
      );

      const res = await agent.get(`/api/v1/orders/${orderId}/tracking`);

      expect(res.body.data.events).toHaveLength(200);
      // Se conservan los MÁS RECIENTES (bulk-5..bulk-204), en orden cronológico ascendente.
      const times = res.body.data.events.map((e: { occurredAt: string }) => e.occurredAt);
      expect(times[0]).toBe(new Date(Date.UTC(2026, 8, 21, 0, 0, 5)).toISOString());
      expect(times.at(-1)).toBe(new Date(Date.UTC(2026, 8, 21, 0, 0, 204)).toISOString());
      expect([...times].sort()).toEqual(times);
    });
  });

  describe("GET /admin/orders/:id/tracking", () => {
    it("401 sin sesión y 403 para una clienta", async () => {
      expect((await request(app).get("/api/v1/admin/orders/64b7f0c2a1b2c3d4e5f60718/tracking")).status).toBe(401);
      const { agent } = await createCustomerSession(app);
      expect((await agent.get("/api/v1/admin/orders/64b7f0c2a1b2c3d4e5f60718/tracking")).status).toBe(403);
    });

    it("el admin ve el proveedor y el id de cada evento", async () => {
      const customer = await createCustomerSession(app);
      const orderId = await seedTrackedOrder({ userId: customer.userId });
      const { agent } = await createAdminSession(app);

      const res = await agent.get(`/api/v1/admin/orders/${orderId}/tracking`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("in_transit");
      expect(res.body.data.events.map((e: { providerEventId: string }) => e.providerEventId)).toEqual(["e1", "e2", "e3"]);
      expect(res.body.data.events[0].provider).toBe("skydropx");
    });

    it("pedido inexistente 404, id inválido 400", async () => {
      const { agent } = await createAdminSession(app);
      expect((await agent.get("/api/v1/admin/orders/64b7f0c2a1b2c3d4e5f60718/tracking")).status).toBe(404);
      expect((await agent.get("/api/v1/admin/orders/no-es-id/tracking")).status).toBe(400);
    });
  });
});
