import request from "supertest";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { ShippingCarrier, SubscriptionShipmentStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { buildApp } from "../../src/app.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { createCycleShipment } from "../../src/services/subscription-shipment.service.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import {
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscribedAccount,
  seedSubscriptionVariantWithStock,
} from "../helpers/subscription-fixtures.js";

/**
 * Panel de envíos de suscripción (Milestone 1.7.2b, Fase 4). Las guardas de
 * transición viven en el service y ya están probadas ahí: aquí se prueba el
 * contrato HTTP — autorización, validación del body y forma de la respuesta.
 */

const app = buildApp();
const PERIOD_START = new Date("2026-09-15T12:00:00Z");

async function seedShipment() {
  const plan = await seedPlanWithStripeRefs();
  const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
  await seedPublishedEdition({
    planId: plan._id.toString(),
    cycleYear: 2026,
    cycleMonth: 9,
    items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
  });
  const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
  const result = await createCycleShipment({
    accountId: account._id,
    userId: account.userId,
    planId: plan._id,
    invoiceRef: `in_${new Types.ObjectId().toString()}`,
    servicePeriodStart: PERIOD_START,
  });
  return { shipment: result.shipment, variantId };
}

describe("routes/admin-subscription-shipment — autorización", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/subscription-shipments");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/subscription-shipments");
    expect(response.status).toBe(403);
  });
});

describe("routes/admin-subscription-shipment — listado y detalle", () => {
  it("lista los envíos con paginación", async () => {
    const { shipment } = await seedShipment();
    const { agent } = await createAdminSession(app);

    const response = await agent.get("/api/v1/admin/subscription-shipments");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(shipment._id.toString());
    expect(response.body.meta.total).toBe(1);
  });

  it("filtra por estado", async () => {
    await seedShipment();
    const { agent } = await createAdminSession(app);

    const response = await agent.get("/api/v1/admin/subscription-shipments?status=shipped");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it("rechaza un estado que no existe en el vocabulario", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get("/api/v1/admin/subscription-shipments?status=extraviado");
    expect(response.status).toBe(400);
  });

  it("devuelve el detalle de un envío", async () => {
    const { shipment } = await seedShipment();
    const { agent } = await createAdminSession(app);

    const response = await agent.get(`/api/v1/admin/subscription-shipments/${shipment._id.toString()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.reservedItems).toHaveLength(1);
  });

  it("un id inexistente responde 404", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get(`/api/v1/admin/subscription-shipments/${new Types.ObjectId().toString()}`);
    expect(response.status).toBe(404);
  });
});

describe("routes/admin-subscription-shipment — PATCH /:id/status", () => {
  it("mueve el envío a processing", async () => {
    const { shipment } = await seedShipment();
    const { agent } = await createAdminSession(app);

    const response = await agent
      .patch(`/api/v1/admin/subscription-shipments/${shipment._id.toString()}/status`)
      .send({ status: SubscriptionShipmentStatus.PROCESSING });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(SubscriptionShipmentStatus.PROCESSING);
  });

  it("marcar enviado exige guía: sin ella es 400", async () => {
    const { shipment } = await seedShipment();
    const { agent } = await createAdminSession(app);
    await agent
      .patch(`/api/v1/admin/subscription-shipments/${shipment._id.toString()}/status`)
      .send({ status: SubscriptionShipmentStatus.PROCESSING });

    const response = await agent
      .patch(`/api/v1/admin/subscription-shipments/${shipment._id.toString()}/status`)
      .send({ status: SubscriptionShipmentStatus.SHIPPED });

    expect(response.status).toBe(400);
  });

  it("marcar enviado con guía descuenta el inventario", async () => {
    const { shipment, variantId } = await seedShipment();
    const { agent } = await createAdminSession(app);
    await agent
      .patch(`/api/v1/admin/subscription-shipments/${shipment._id.toString()}/status`)
      .send({ status: SubscriptionShipmentStatus.PROCESSING });

    const response = await agent
      .patch(`/api/v1/admin/subscription-shipments/${shipment._id.toString()}/status`)
      .send({
        status: SubscriptionShipmentStatus.SHIPPED,
        carrier: ShippingCarrier.ESTAFETA,
        trackingNumber: "ES123456789MX",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.trackingNumber).toBe("ES123456789MX");
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(8);
    expect(inventory?.reserved).toBe(0);
  });

  it("una transición inválida responde 409", async () => {
    const { shipment } = await seedShipment();
    const { agent } = await createAdminSession(app);

    const response = await agent
      .patch(`/api/v1/admin/subscription-shipments/${shipment._id.toString()}/status`)
      .send({ status: SubscriptionShipmentStatus.DELIVERED });

    expect(response.status).toBe(409);
  });
});
