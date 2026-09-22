import request from "supertest";
import { DEFAULT_INVENTORY_SETTINGS, InventoryAction } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

describe("routes/admin-settings", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/settings");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/settings");
    expect(response.status).toBe(403);
  });

  it("GET sin documento devuelve los defaults", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get("/api/v1/admin/settings");

    expect(response.status).toBe(200);
    expect(response.body.data.inventory).toEqual(DEFAULT_INVENTORY_SETTINGS);
  });

  it("PATCH persiste y el GET siguiente lo refleja", async () => {
    const { agent } = await createAdminSession(app);

    const patch = await agent.patch("/api/v1/admin/settings/inventory").send({ lowStockThreshold: 20 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.lowStockThreshold).toBe(20);

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.inventory.lowStockThreshold).toBe(20);

    const entry = await AuditLog.findOne({ action: InventoryAction.SETTINGS_UPDATED });
    expect(entry).not.toBeNull();
    expect(entry?.metadata).toMatchObject({ section: "inventory", lowStockThreshold: 20 });
  });

  it("cada PATCH audita con `metadata.section` identificando la sección que cambió", async () => {
    const { agent } = await createAdminSession(app);

    await agent.patch("/api/v1/admin/settings/inventory").send({ lowStockThreshold: 12 });
    await agent.patch("/api/v1/admin/settings/commerce").send({ taxRateBps: 800 });
    await agent.patch("/api/v1/admin/settings/payments").send({ oxxoVoucherDays: 3 });
    await agent.patch("/api/v1/admin/settings/subscriptions").send({ billingAnchorDay: 5 });

    const entries = await AuditLog.find({ action: InventoryAction.SETTINGS_UPDATED }).sort({ createdAt: 1 });
    expect(entries.map((entry) => (entry.metadata as { section: string }).section)).toEqual([
      "inventory",
      "commerce",
      "payments",
      "subscriptions",
    ]);
  });

  it("una clave desconocida responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .patch("/api/v1/admin/settings/inventory")
      .send({ unknownField: 1 });
    expect(response.status).toBe(400);
  });

  it("PATCH /commerce persiste y el GET siguiente lo refleja, sin pisar inventory", async () => {
    const { agent } = await createAdminSession(app);

    await agent.patch("/api/v1/admin/settings/inventory").send({ lowStockThreshold: 15 });
    const patch = await agent.patch("/api/v1/admin/settings/commerce").send({ taxRateBps: 800 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.taxRateBps).toBe(800);

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.commerce.taxRateBps).toBe(800);
    expect(get.body.data.inventory.lowStockThreshold).toBe(15);
  });

  it("PATCH /commerce rechaza un shippingQuoteTtlMinutes menor o igual al TTL de reserva", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .patch("/api/v1/admin/settings/commerce")
      .send({ shippingQuoteTtlMinutes: 5 });
    expect(response.status).toBe(400);
  });

  it("PATCH /payments persiste y el GET siguiente lo refleja, sin pisar commerce", async () => {
    const { agent } = await createAdminSession(app);

    await agent.patch("/api/v1/admin/settings/commerce").send({ taxRateBps: 700 });
    const patch = await agent.patch("/api/v1/admin/settings/payments").send({ oxxoVoucherDays: 4 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.oxxoVoucherDays).toBe(4);

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.payments.oxxoVoucherDays).toBe(4);
    expect(get.body.data.commerce.taxRateBps).toBe(700);
  });

  it("PATCH /payments rechaza oxxoVoucherDays fuera de 1-7", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.patch("/api/v1/admin/settings/payments").send({ oxxoVoucherDays: 10 });
    expect(response.status).toBe(400);
  });

  it("PATCH /subscriptions persiste y el GET siguiente lo refleja, sin pisar payments", async () => {
    const { agent } = await createAdminSession(app);

    await agent.patch("/api/v1/admin/settings/payments").send({ oxxoVoucherDays: 6 });
    const patch = await agent
      .patch("/api/v1/admin/settings/subscriptions")
      .send({ billingAnchorDay: 20 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.billingAnchorDay).toBe(20);

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.subscriptions.billingAnchorDay).toBe(20);
    expect(get.body.data.payments.oxxoVoucherDays).toBe(6);
  });

  it("PATCH /subscriptions rechaza billingAnchorDay fuera de 1-28", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .patch("/api/v1/admin/settings/subscriptions")
      .send({ billingAnchorDay: 29 });
    expect(response.status).toBe(400);
  });

  describe("PATCH /shipping (dirección de origen, Milestone 1.9)", () => {
    const origin = {
      fullName: "Esencia Glow",
      phone: "3312345678",
      street: "Av. Vallarta",
      exteriorNumber: "1234",
      neighborhood: "Americana",
      city: "Guadalajara",
      state: "Jalisco",
      postalCode: "44160",
    };

    it("GET sin documento devuelve shipping sin origen (aún no capturado)", async () => {
      const { agent } = await createAdminSession(app);
      const response = await agent.get("/api/v1/admin/settings");
      expect(response.body.data.shipping).toEqual({});
    });

    it("persiste el origen y el GET siguiente lo refleja, sin pisar otras secciones", async () => {
      const { agent } = await createAdminSession(app);
      await agent.patch("/api/v1/admin/settings/commerce").send({ taxRateBps: 800 });

      const patch = await agent.patch("/api/v1/admin/settings/shipping").send({ origin });
      expect(patch.status).toBe(200);
      expect(patch.body.data.origin).toMatchObject(origin);

      const get = await agent.get("/api/v1/admin/settings");
      expect(get.body.data.shipping.origin).toMatchObject(origin);
      expect(get.body.data.commerce.taxRateBps).toBe(800);
    });

    it("un segundo PATCH REEMPLAZA el origen completo (no mezcla campos del anterior)", async () => {
      const { agent } = await createAdminSession(app);
      await agent.patch("/api/v1/admin/settings/shipping").send({ origin: { ...origin, interiorNumber: "5B" } });
      await agent.patch("/api/v1/admin/settings/shipping").send({ origin });

      const get = await agent.get("/api/v1/admin/settings");
      expect(get.body.data.shipping.origin.interiorNumber).toBeUndefined();
    });

    it("audita con section 'shipping' y SIN la dirección (sin PII en el trail)", async () => {
      const { agent } = await createAdminSession(app);
      await agent.patch("/api/v1/admin/settings/shipping").send({ origin });

      const entry = await AuditLog.findOne({ action: InventoryAction.SETTINGS_UPDATED });
      expect(entry?.metadata).toEqual({ section: "shipping", field: "origin" });
    });

    it("rechaza un origen incompleto o inválido con 400", async () => {
      const { agent } = await createAdminSession(app);
      const missing = await agent.patch("/api/v1/admin/settings/shipping").send({ origin: { fullName: "X" } });
      expect(missing.status).toBe(400);
      const badZip = await agent.patch("/api/v1/admin/settings/shipping").send({ origin: { ...origin, postalCode: "12" } });
      expect(badZip.status).toBe(400);
      const empty = await agent.patch("/api/v1/admin/settings/shipping").send({});
      expect(empty.status).toBe(400);
    });

    it("un customer recibe 403", async () => {
      const { agent } = await createCustomerSession(app);
      const response = await agent.patch("/api/v1/admin/settings/shipping").send({ origin });
      expect(response.status).toBe(403);
    });
  });
});
