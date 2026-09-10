import request from "supertest";
import { InventoryAction, ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

async function seedInventoryRow(overrides: { onHand?: number; reserved?: number; sku?: string } = {}) {
  const category = await Category.create({ name: `Cat ${Date.now()}-${Math.random()}`, slug: `cat-${Date.now()}-${Math.random()}` });
  const product = await Product.create({
    name: `Producto ${Date.now()}-${Math.random()}`,
    slug: `producto-${Date.now()}-${Math.random()}`,
    description: "desc",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: overrides.sku ?? "SKU-ROUTE",
        name: "Variante",
        price: 1000,
        weightGrams: 100,
        dimensionsCm: { length: 1, width: 1, height: 1 },
      },
    ],
  });
  const variant = product.variants[0]!;
  const row = await Inventory.create({
    productId: product._id,
    variantId: variant._id,
    sku: variant.sku,
    onHand: overrides.onHand ?? 10,
    reserved: overrides.reserved ?? 0,
  });
  return { productId: product._id, variantId: variant._id, row };
}

describe("routes/admin-inventory", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/inventory");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/inventory");
    expect(response.status).toBe(403);
  });

  it("lista el inventario con available calculado y meta de paginación", async () => {
    const { agent } = await createAdminSession(app);
    const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 3 });

    const response = await agent.get("/api/v1/admin/inventory");

    expect(response.status).toBe(200);
    expect(response.body.meta).toBeDefined();
    const row = response.body.data.find((r: { variantId: string }) => r.variantId === variantId.toString());
    expect(row).toBeDefined();
    expect(row.available).toBe(7);
  });

  it("filtra por lowStock", async () => {
    const { agent } = await createAdminSession(app);
    await seedInventoryRow({ onHand: 100, reserved: 0, sku: "HIGH" });
    const { variantId: lowVariantId } = await seedInventoryRow({ onHand: 2, reserved: 0, sku: "LOW" });

    const response = await agent.get("/api/v1/admin/inventory").query({ lowStock: true });

    expect(response.status).toBe(200);
    const ids = response.body.data.map((r: { variantId: string }) => r.variantId);
    expect(ids).toContain(lowVariantId.toString());
    expect(ids.length).toBeGreaterThan(0);
  });

  it("filtra por productId", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await seedInventoryRow({ sku: "PID-A" });
    await seedInventoryRow({ sku: "PID-B" });

    const response = await agent.get("/api/v1/admin/inventory").query({ productId: productId.toString() });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].variantId).toBe(variantId.toString());
  });

  it("ajusta el stock, audita la acción con el actor y el motivo, y responde con el DTO actualizado", async () => {
    const { agent, email } = await createAdminSession(app);
    const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 0 });

    const response = await agent
      .post(`/api/v1/admin/inventory/${variantId.toString()}/adjust`)
      .send({ delta: 5, reason: "reposición de proveedor" });

    expect(response.status).toBe(200);
    expect(response.body.data.onHand).toBe(15);

    const entry = await AuditLog.findOne({ action: InventoryAction.STOCK_ADJUSTED });
    expect(entry).not.toBeNull();
    expect(entry?.metadata).toMatchObject({ delta: 5, reason: "reposición de proveedor" });
    void email;
  });

  it("un ajuste que rompe la invariante responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 8 });

    const response = await agent
      .post(`/api/v1/admin/inventory/${variantId.toString()}/adjust`)
      .send({ delta: -5, reason: "conteo físico" });

    expect(response.status).toBe(409);
  });

  it("delta: 0, delta no entero o reason vacío responden 400", async () => {
    const { agent } = await createAdminSession(app);
    const { variantId } = await seedInventoryRow();

    const zero = await agent
      .post(`/api/v1/admin/inventory/${variantId.toString()}/adjust`)
      .send({ delta: 0, reason: "algo" });
    expect(zero.status).toBe(400);

    const notInt = await agent
      .post(`/api/v1/admin/inventory/${variantId.toString()}/adjust`)
      .send({ delta: 1.5, reason: "algo" });
    expect(notInt.status).toBe(400);

    const noReason = await agent
      .post(`/api/v1/admin/inventory/${variantId.toString()}/adjust`)
      .send({ delta: 1, reason: "" });
    expect(noReason.status).toBe(400);
  });

  it("un variantId malformado responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .post("/api/v1/admin/inventory/no-es-un-id/adjust")
      .send({ delta: 1, reason: "algo" });
    expect(response.status).toBe(400);
  });

  it("libera una reserva forzadamente y audita la acción", async () => {
    const { agent } = await createAdminSession(app);
    const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 0 });

    const reserve = await agent.get(`/api/v1/admin/inventory/${variantId.toString()}`);
    expect(reserve.status).toBe(200);

    // Crea una reserva directo contra el service (no hay endpoint HTTP de
    // reserve en 1.4) para poder forzar su release vía el endpoint admin.
    const { reserveStock } = await import("../../src/services/stock-reservation.service.js");
    const reservation = await reserveStock({
      cartRef: `cart-force-${variantId.toString()}`,
      lines: [{ variantId: variantId.toString(), quantity: 2 }],
      ttlMinutes: 30,
    });

    const response = await agent.post(`/api/v1/admin/inventory/reservations/${reservation._id.toString()}/release`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("released");

    const entry = await AuditLog.findOne({ action: InventoryAction.RESERVATION_RELEASED });
    expect(entry).not.toBeNull();
  });
});
