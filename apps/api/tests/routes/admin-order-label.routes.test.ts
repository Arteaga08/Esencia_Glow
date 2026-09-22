import { OrderStatus, ShippingCarrier, ShippingLabelStatus } from "@esencia-glow/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Order } from "../../src/models/order.model.js";
import { __flushLabelTriggersForTests, __setLabelTriggerEnabledForTests } from "../../src/services/order-label-trigger.js";
import { __setShippingProviderForTests } from "../../src/services/shipping-provider.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { buildFakeShippingProvider } from "../helpers/fake-shipping-provider.js";
import { seedPaidOrder, seedShippingOrigin } from "../helpers/paid-order-fixtures.js";

const app = buildApp();

describe("routes/admin-orders — guía de envío (label)", () => {
  beforeEach(async () => {
    resetCheckoutFixtureCounter();
    await seedShippingOrigin();
  });

  afterEach(async () => {
    await __flushLabelTriggersForTests();
    __setLabelTriggerEnabledForTests(false);
  });

  async function seedOrderWithLabel(label: Record<string, unknown>) {
    const seeded = await seedPaidOrder();
    await Order.updateOne({ _id: seeded.orderId }, { $set: { label } });
    return seeded;
  }

  describe("GET /admin/orders/:id expone la guía", () => {
    it("incluye label con estado, intentos, error, guía y fechas ISO", async () => {
      const { agent } = await createAdminSession(app);
      const readyAt = new Date("2026-09-21T15:00:00Z");
      const { orderId } = await seedOrderWithLabel({
        status: ShippingLabelStatus.READY,
        attempts: 2,
        providerShipmentId: "ship-1",
        trackingNumber: "TRK-1",
        carrier: ShippingCarrier.FEDEX,
        labelUrl: "https://labels.example/1.pdf",
        trackingUrl: "https://track.example/1",
        readyAt,
        lastError: "Falla previa",
      });

      const res = await agent.get(`/api/v1/admin/orders/${orderId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.label).toEqual({
        status: "ready",
        attempts: 2,
        providerShipmentId: "ship-1",
        trackingNumber: "TRK-1",
        carrier: "fedex",
        labelUrl: "https://labels.example/1.pdf",
        trackingUrl: "https://track.example/1",
        readyAt: readyAt.toISOString(),
        lastError: "Falla previa",
      });
    });

    it("una orden pagada recién encolada muestra label pending; una sin label no trae la clave", async () => {
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedPaidOrder();
      const withLabel = await agent.get(`/api/v1/admin/orders/${orderId}`);
      expect(withLabel.body.data.label.status).toBe("pending");

      await Order.updateOne({ _id: orderId }, { $unset: { label: "" } });
      const without = await agent.get(`/api/v1/admin/orders/${orderId}`);
      expect(without.body.data.label).toBeUndefined();
    });

    it("la clienta NUNCA ve la guía ni ids del proveedor en su detalle de orden", async () => {
      const { orderId } = await seedOrderWithLabel({
        status: ShippingLabelStatus.READY,
        attempts: 1,
        providerShipmentId: "ship-secret",
        trackingNumber: "TRK-1",
        labelUrl: "https://labels.example/1.pdf",
      });
      const { agent, userId } = await createCustomerSession(app);
      await Order.updateOne({ _id: orderId }, { $set: { userId } }); // la clienta es dueña de esta orden

      const res = await agent.get(`/api/v1/orders/${orderId}`);

      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("label");
      expect(body).not.toContain("ship-secret");
    });
  });

  describe("PATCH /admin/orders/:id/shipping-address con la guía ya en marcha", () => {
    const newAddress = {
      fullName: "Ana Pérez",
      phone: "5512345678",
      street: "Calle Nueva",
      exteriorNumber: "9",
      neighborhood: "Centro",
      city: "CDMX",
      state: "Ciudad de México",
      postalCode: "06000",
    };

    it.each([ShippingLabelStatus.REQUESTED, ShippingLabelStatus.PROCESSING, ShippingLabelStatus.READY])(
      "con la guía en '%s' responde 409 y NO cambia la dirección (la etiqueta ya apunta a la vieja)",
      async (status) => {
        const { agent } = await createAdminSession(app);
        const { orderId } = await seedOrderWithLabel({ status, attempts: 1 });
        const before = (await Order.findById(orderId).lean())!.shippingAddress;

        const res = await agent.patch(`/api/v1/admin/orders/${orderId}/shipping-address`).send(newAddress);

        expect(res.status).toBe(409);
        expect(res.body.message).toContain("guía");
        expect((await Order.findById(orderId).lean())!.shippingAddress).toEqual(before);
      },
    );

    it.each([ShippingLabelStatus.PENDING, ShippingLabelStatus.FAILED, ShippingLabelStatus.NEEDS_REVIEW])(
      "con la guía en '%s' (nada comprado) SÍ se puede corregir",
      async (status) => {
        const { agent } = await createAdminSession(app);
        const { orderId } = await seedOrderWithLabel({ status, attempts: 1 });

        const res = await agent.patch(`/api/v1/admin/orders/${orderId}/shipping-address`).send(newAddress);

        expect(res.status).toBe(200);
        expect((await Order.findById(orderId).lean())!.shippingAddress.street).toBe("Calle Nueva");
      },
    );

    it("una orden sin guía (anterior a 1.9) sigue pudiéndose corregir", async () => {
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $unset: { label: "" } });
      expect((await agent.patch(`/api/v1/admin/orders/${orderId}/shipping-address`).send(newAddress)).status).toBe(200);
    });
  });

  describe("POST /admin/orders/:id/label/retry", () => {
    it("401 sin sesión y 403 para una clienta", async () => {
      const { orderId } = await seedPaidOrder();
      expect((await request(app).post(`/api/v1/admin/orders/${orderId}/label/retry`)).status).toBe(401);
      const { agent } = await createCustomerSession(app);
      expect((await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`)).status).toBe(403);
    });

    it("needs_review SIN providerShipmentId vuelve a pending con 0 intentos, sin alerta previa, y audita con el admin", async () => {
      const { agent, adminId } = await createAdminSession(app);
      const { orderId } = await seedOrderWithLabel({
        status: ShippingLabelStatus.NEEDS_REVIEW,
        attempts: 3,
        lastError: "Timeout",
        adminAlertedAt: new Date(),
        requestedAt: new Date(),
      });

      const res = await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`);

      expect(res.status).toBe(202);
      expect(res.body.data.label.status).toBe("pending");
      const order = await Order.findById(orderId).lean();
      expect(order!.label!.status).toBe(ShippingLabelStatus.PENDING);
      expect(order!.label!.attempts).toBe(0);
      expect(order!.label!.adminAlertedAt).toBeUndefined();
      expect(order!.label!.nextAttemptAt).toBeInstanceOf(Date);
      const audit = await AuditLog.findOne({ action: "label_retry_requested", targetId: orderId }).lean();
      expect(audit!.actorId!.toString()).toBe(adminId);
      expect(audit!.metadata).toMatchObject({ mode: "purchase" });
    });

    it("una guía failed también se puede reintentar", async () => {
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedOrderWithLabel({ status: ShippingLabelStatus.FAILED, attempts: 2, nextAttemptAt: new Date(Date.now() + 3_600_000) });

      const res = await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`);

      expect(res.status).toBe(202);
      expect((await Order.findById(orderId).lean())!.label!.status).toBe(ShippingLabelStatus.PENDING);
    });

    it("needs_review CON providerShipmentId (el proveedor ya cobró) vuelve a processing para CONSULTAR, nunca a pending", async () => {
      const { agent } = await createAdminSession(app);
      const stale = new Date(Date.now() - 24 * 3_600_000);
      const { orderId } = await seedOrderWithLabel({
        status: ShippingLabelStatus.NEEDS_REVIEW,
        attempts: 1,
        providerShipmentId: "ship-paid",
        requestedAt: stale,
        adminAlertedAt: new Date(),
      });

      const res = await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`);

      expect(res.status).toBe(202);
      const order = await Order.findById(orderId).lean();
      expect(order!.label!.status).toBe(ShippingLabelStatus.PROCESSING);
      expect(order!.label!.providerShipmentId).toBe("ship-paid");
      expect(order!.label!.requestedAt!.getTime()).toBeGreaterThan(stale.getTime());
      expect(order!.label!.adminAlertedAt).toBeUndefined();
      const audit = await AuditLog.findOne({ action: "label_retry_requested", targetId: orderId }).lean();
      expect(audit!.metadata).toMatchObject({ mode: "poll" });
    });

    it.each([ShippingLabelStatus.PENDING, ShippingLabelStatus.REQUESTED, ShippingLabelStatus.PROCESSING, ShippingLabelStatus.READY])(
      "una guía en '%s' NO se puede reintentar: 409 y sin cambios",
      async (status) => {
        const { agent } = await createAdminSession(app);
        const { orderId } = await seedOrderWithLabel({ status, attempts: 1 });

        const res = await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`);

        expect(res.status).toBe(409);
        expect((await Order.findById(orderId).lean())!.label!.status).toBe(status);
      },
    );

    it("una orden sin guía (anterior a 1.9 o con inventory_incident) responde 409", async () => {
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $unset: { label: "" } });
      expect((await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`)).status).toBe(409);
    });

    it("una orden ya enviada (shipped) no se reintenta: 409", async () => {
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedOrderWithLabel({ status: ShippingLabelStatus.NEEDS_REVIEW, attempts: 5 });
      await Order.updateOne({ _id: orderId }, { $set: { status: OrderStatus.SHIPPED } });
      expect((await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`)).status).toBe(409);
    });

    it("una orden inexistente responde 404 y un id inválido 400", async () => {
      const { agent } = await createAdminSession(app);
      expect((await agent.post("/api/v1/admin/orders/64b7f0c2a1b2c3d4e5f60718/label/retry")).status).toBe(404);
      expect((await agent.post("/api/v1/admin/orders/no-es-un-id/label/retry")).status).toBe(400);
    });

    it("dos reintentos concurrentes: uno gana y el otro recibe 409 (no se duplica el encolado)", async () => {
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedOrderWithLabel({ status: ShippingLabelStatus.NEEDS_REVIEW, attempts: 5 });

      const results = await Promise.all([
        agent.post(`/api/v1/admin/orders/${orderId}/label/retry`),
        agent.post(`/api/v1/admin/orders/${orderId}/label/retry`),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([202, 409]);
      expect(await AuditLog.countDocuments({ action: "label_retry_requested", targetId: orderId })).toBe(1);
    });

    it("tras reintentar (modo purchase) dispara la compra de inmediato", async () => {
      __setLabelTriggerEnabledForTests(true);
      const provider = buildFakeShippingProvider();
      __setShippingProviderForTests(provider);
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedOrderWithLabel({ status: ShippingLabelStatus.NEEDS_REVIEW, attempts: 5 });

      await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`);
      await __flushLabelTriggersForTests();

      expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
      expect((await Order.findById(orderId).lean())!.label!.status).toBe(ShippingLabelStatus.READY);
    });

    it("el endpoint por sí mismo NO compra nada cuando el disparo está apagado", async () => {
      const provider = buildFakeShippingProvider();
      __setShippingProviderForTests(provider);
      const { agent } = await createAdminSession(app);
      const { orderId } = await seedOrderWithLabel({ status: ShippingLabelStatus.NEEDS_REVIEW, attempts: 5 });

      await agent.post(`/api/v1/admin/orders/${orderId}/label/retry`);

      expect(provider.purchaseLabel).not.toHaveBeenCalled();
    });
  });
});
