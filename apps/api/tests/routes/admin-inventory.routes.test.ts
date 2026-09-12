import request from "supertest";
import { InventoryAction, ProductStatus, StockStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

async function seedProduct(sku = "SKU-ROUTE") {
  const category = await Category.create({ name: `Cat ${Date.now()}-${Math.random()}`, slug: `cat-${Date.now()}-${Math.random()}` });
  const product = await Product.create({
    name: `Producto ${Date.now()}-${Math.random()}`,
    slug: `producto-${Date.now()}-${Math.random()}`,
    description: "desc",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku,
        name: "Variante",
        price: 1000,
        weightGrams: 100,
        dimensionsCm: { length: 1, width: 1, height: 1 },
      },
    ],
  });
  const variant = product.variants[0]!;
  return { productId: product._id, variantId: variant._id, sku: variant.sku };
}

async function seedInventoryRow(overrides: { onHand?: number; reserved?: number; sku?: string } = {}) {
  const { productId, variantId, sku } = await seedProduct(overrides.sku ?? "SKU-ROUTE");
  const row = await Inventory.create({
    productId,
    variantId,
    sku,
    onHand: overrides.onHand ?? 10,
    reserved: overrides.reserved ?? 0,
  });
  return { productId, variantId, row };
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

  describe("GET / — panel por producto", () => {
    it("lista con meta de paginación y statusCounts", async () => {
      const { agent } = await createAdminSession(app);
      await seedInventoryRow({ onHand: 10, reserved: 3 });

      const response = await agent.get("/api/v1/admin/inventory");

      expect(response.status).toBe(200);
      expect(response.body.meta).toBeDefined();
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.statusCounts).toBeDefined();
    });

    it("filtra por status", async () => {
      const { agent } = await createAdminSession(app);
      await seedInventoryRow({ onHand: 0, reserved: 0, sku: "OUT-ROUTE" });
      await seedInventoryRow({ onHand: 100, reserved: 0, sku: "OK-ROUTE" });

      const response = await agent.get("/api/v1/admin/inventory").query({ status: StockStatus.OUT });

      expect(response.status).toBe(200);
      for (const item of response.body.data.items) {
        expect(item.status).toBe(StockStatus.OUT);
      }
    });
  });

  describe("GET /products/:productId — detalle", () => {
    it("incluye variantes sin fila de inventario", async () => {
      const { agent } = await createAdminSession(app);
      const category = await Category.create({ name: "Cat Detail", slug: "cat-detail-route" });
      const product = await Product.create({
        name: "Producto Detalle Route",
        slug: "producto-detalle-route",
        description: "desc",
        categoryId: category._id,
        variants: [
          { sku: "DET-R-A", name: "A", price: 100, weightGrams: 10, dimensionsCm: { length: 1, width: 1, height: 1 } },
        ],
      });

      const response = await agent.get(`/api/v1/admin/inventory/products/${product._id.toString()}`);

      expect(response.status).toBe(200);
      expect(response.body.data.variants[0].inventoryItemId).toBeNull();
    });

    it("un productId inexistente responde 404", async () => {
      const { agent } = await createAdminSession(app);
      const response = await agent.get("/api/v1/admin/inventory/products/aaaaaaaaaaaaaaaaaaaaaaaa");
      expect(response.status).toBe(404);
    });
  });

  describe("POST / — alta de fila al vuelo", () => {
    it("crea la fila, audita y responde 201", async () => {
      const { agent } = await createAdminSession(app);
      const { productId, variantId } = await seedProduct("CREATE-ROUTE");

      const response = await agent.post("/api/v1/admin/inventory").send({
        productId: productId.toString(),
        variantId: variantId.toString(),
        onHand: 25,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.onHand).toBe(25);
      expect(response.body.data.sku).toBe("CREATE-ROUTE");

      const entry = await AuditLog.findOne({ action: InventoryAction.INVENTORY_ITEM_CREATED });
      expect(entry).not.toBeNull();
    });

    it("una segunda alta para la misma variante responde 409", async () => {
      const { agent } = await createAdminSession(app);
      const { productId, variantId } = await seedProduct("DUP-ROUTE");
      await agent.post("/api/v1/admin/inventory").send({
        productId: productId.toString(),
        variantId: variantId.toString(),
        onHand: 1,
      });

      const response = await agent.post("/api/v1/admin/inventory").send({
        productId: productId.toString(),
        variantId: variantId.toString(),
        onHand: 2,
      });

      expect(response.status).toBe(409);
    });
  });

  describe("PATCH /:variantId/stock — ajuste manual", () => {
    it("modo delta: ajusta, audita con before/after y responde con el DTO actualizado", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 0 });

      const response = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`)
        .send({ delta: 5, reason: "reposición de proveedor" });

      expect(response.status).toBe(200);
      expect(response.body.data.onHand).toBe(15);

      const entry = await AuditLog.findOne({ action: InventoryAction.STOCK_ADJUSTED });
      expect(entry).not.toBeNull();
      expect(entry?.metadata).toMatchObject({
        mode: "delta",
        delta: 5,
        onHandBefore: 10,
        onHandAfter: 15,
        reason: "reposición de proveedor",
      });
    });

    it("modo recuento (onHand): fija el valor absoluto y audita mode=recount", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 0 });

      const response = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`)
        .send({ onHand: 30 });

      expect(response.status).toBe(200);
      expect(response.body.data.onHand).toBe(30);

      const entry = await AuditLog.findOne({ action: InventoryAction.STOCK_ADJUSTED });
      expect(entry?.metadata).toMatchObject({ mode: "recount", onHandBefore: 10, onHandAfter: 30 });
    });

    it("reason es opcional", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 0 });

      const response = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`)
        .send({ delta: 1 });

      expect(response.status).toBe(200);
    });

    it("delta y onHand juntos responden 400", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow();

      const response = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`)
        .send({ delta: 1, onHand: 5 });

      expect(response.status).toBe(400);
    });

    it("ni delta ni onHand responden 400", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow();

      const response = await agent.patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`).send({});

      expect(response.status).toBe(400);
    });

    it("un ajuste que rompe la invariante responde 409", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 8 });

      const response = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`)
        .send({ delta: -5 });

      expect(response.status).toBe(409);
    });

    it("delta: 0 o no entero responde 400", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow();

      const zero = await agent.patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`).send({ delta: 0 });
      expect(zero.status).toBe(400);

      const notInt = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}/stock`)
        .send({ delta: 1.5 });
      expect(notInt.status).toBe(400);
    });

    it("un variantId malformado responde 400", async () => {
      const { agent } = await createAdminSession(app);
      const response = await agent
        .patch("/api/v1/admin/inventory/no-es-un-id/stock")
        .send({ delta: 1 });
      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /:variantId — override de umbral", () => {
    it("fija el override y audita", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow();

      const response = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}`)
        .send({ lowStockThreshold: 3 });

      expect(response.status).toBe(200);
      expect(response.body.data.lowStockThreshold).toBe(3);

      const entry = await AuditLog.findOne({ action: InventoryAction.LOW_STOCK_THRESHOLD_UPDATED });
      expect(entry).not.toBeNull();
    });

    it("null quita el override", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow();
      await agent.patch(`/api/v1/admin/inventory/${variantId.toString()}`).send({ lowStockThreshold: 3 });

      const response = await agent
        .patch(`/api/v1/admin/inventory/${variantId.toString()}`)
        .send({ lowStockThreshold: null });

      expect(response.status).toBe(200);
      expect(response.body.data.lowStockThreshold).toBeNull();
    });
  });

  describe("GET /:variantId", () => {
    it("responde con el DTO enriquecido (status, umbral efectivo)", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow({ onHand: 2, reserved: 0 });

      const response = await agent.get(`/api/v1/admin/inventory/${variantId.toString()}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.effectiveLowStockThreshold).toBeDefined();
    });
  });

  describe("reservas", () => {
    it("libera una reserva forzadamente y audita la acción", async () => {
      const { agent } = await createAdminSession(app);
      const { variantId } = await seedInventoryRow({ onHand: 10, reserved: 0 });

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
});
