import { describe, expect, it } from "vitest";
import { StockStatus } from "@esencia-glow/shared";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { listInventoryPanel, getProductInventoryDetail } from "../../src/services/inventory-panel.service.js";

async function seedCategory(suffix: string) {
  return Category.create({ name: `Cat ${suffix}`, slug: `cat-${suffix}` });
}

function variant(sku: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sku,
    name: sku,
    price: 1000,
    weightGrams: 100,
    dimensionsCm: { length: 1, width: 1, height: 1 },
    ...overrides,
  };
}

describe("services/inventory-panel", () => {
  describe("listInventoryPanel", () => {
    it("un producto con varias variantes cuenta como una sola fila", async () => {
      const category = await seedCategory("panel-1");
      const product = await Product.create({
        name: "Rutina Completa",
        slug: "rutina-completa-panel",
        description: "desc",
        categoryId: category._id,
        variants: [variant("RC-A"), variant("RC-B"), variant("RC-C"), variant("RC-D")],
      });
      for (const v of product.variants) {
        await Inventory.create({ productId: product._id, variantId: v._id, sku: v.sku, onHand: 100, reserved: 0 });
      }

      const { items, meta } = await listInventoryPanel({ page: 1, limit: 20, sort: { field: "name", direction: "asc" } }, 5);

      const row = items.find((i) => i.productId === product._id.toString());
      expect(row).toBeDefined();
      expect(row?.variantCount).toBe(4);
      expect(meta.total).toBe(1);
    });

    it("un producto sin ninguna fila de inventario sigue visible, con untrackedVariantCount", async () => {
      const category = await seedCategory("panel-2");
      const product = await Product.create({
        name: "Producto Sin Registrar",
        slug: "producto-sin-registrar",
        description: "desc",
        categoryId: category._id,
        variants: [variant("UNTRACKED-A"), variant("UNTRACKED-B")],
      });

      const { items } = await listInventoryPanel({ page: 1, limit: 20, sort: { field: "name", direction: "asc" } }, 5);

      const row = items.find((i) => i.productId === product._id.toString());
      expect(row).toBeDefined();
      expect(row?.untrackedVariantCount).toBe(2);
      expect(row?.status).toBe(StockStatus.UNTRACKED);
    });

    it("el status del producto es el peor de sus variantes con fila", async () => {
      const category = await seedCategory("panel-3");
      const product = await Product.create({
        name: "Producto Mixto",
        slug: "producto-mixto",
        description: "desc",
        categoryId: category._id,
        variants: [variant("MIX-OK"), variant("MIX-OUT")],
      });
      await Inventory.create({ productId: product._id, variantId: product.variants[0]!._id, sku: "MIX-OK", onHand: 100, reserved: 0 });
      await Inventory.create({ productId: product._id, variantId: product.variants[1]!._id, sku: "MIX-OUT", onHand: 0, reserved: 0 });

      const { items } = await listInventoryPanel({ page: 1, limit: 20, sort: { field: "name", direction: "asc" } }, 5);

      const row = items.find((i) => i.productId === product._id.toString());
      expect(row?.status).toBe(StockStatus.OUT);
    });

    it("statusCounts se calcula antes del filtro de status", async () => {
      const category = await seedCategory("panel-4");
      const outProduct = await Product.create({
        name: "Producto Agotado",
        slug: "producto-agotado",
        description: "desc",
        categoryId: category._id,
        variants: [variant("OUT-A")],
      });
      await Inventory.create({ productId: outProduct._id, variantId: outProduct.variants[0]!._id, sku: "OUT-A", onHand: 0, reserved: 0 });

      const okProduct = await Product.create({
        name: "Producto OK",
        slug: "producto-ok",
        description: "desc",
        categoryId: category._id,
        variants: [variant("OK-A")],
      });
      await Inventory.create({ productId: okProduct._id, variantId: okProduct.variants[0]!._id, sku: "OK-A", onHand: 100, reserved: 0 });

      const { items, statusCounts } = await listInventoryPanel(
        { page: 1, limit: 20, sort: { field: "name", direction: "asc" }, status: StockStatus.OUT },
        5,
      );

      expect(items).toHaveLength(1);
      expect(items[0]?.status).toBe(StockStatus.OUT);
      expect(statusCounts[StockStatus.OUT]).toBeGreaterThanOrEqual(1);
      expect(statusCounts[StockStatus.OK]).toBeGreaterThanOrEqual(1);
    });

    it("busca por nombre de producto o por sku de variante", async () => {
      const category = await seedCategory("panel-5");
      await Product.create({
        name: "Serum Buscable",
        slug: "serum-buscable",
        description: "desc",
        categoryId: category._id,
        variants: [variant("FINDME-SKU")],
      });

      const byName = await listInventoryPanel(
        { page: 1, limit: 20, sort: { field: "name", direction: "asc" }, search: "Buscable" },
        5,
      );
      expect(byName.items).toHaveLength(1);

      const bySku = await listInventoryPanel(
        { page: 1, limit: 20, sort: { field: "name", direction: "asc" }, search: "FINDME" },
        5,
      );
      expect(bySku.items).toHaveLength(1);
    });
  });

  describe("getProductInventoryDetail", () => {
    it("incluye variantes sin fila de inventario, con inventoryItemId null", async () => {
      const category = await seedCategory("panel-detail-1");
      const product = await Product.create({
        name: "Producto Detalle",
        slug: "producto-detalle",
        description: "desc",
        categoryId: category._id,
        variants: [variant("DET-A"), variant("DET-B")],
      });
      await Inventory.create({ productId: product._id, variantId: product.variants[0]!._id, sku: "DET-A", onHand: 10, reserved: 0 });

      const detail = await getProductInventoryDetail(product._id.toString(), 5);

      const tracked = detail.variants.find((v) => v.sku === "DET-A");
      const untracked = detail.variants.find((v) => v.sku === "DET-B");
      expect(tracked?.inventoryItemId).not.toBeNull();
      expect(tracked?.onHand).toBe(10);
      expect(untracked?.inventoryItemId).toBeNull();
      expect(untracked?.onHand).toBeNull();
      expect(untracked?.status).toBe(StockStatus.UNTRACKED);
    });

    it("responde 404 si el producto no existe", async () => {
      await expect(getProductInventoryDetail("aaaaaaaaaaaaaaaaaaaaaaaa", 5)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
