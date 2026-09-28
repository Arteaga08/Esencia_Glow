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

  describe("listInventoryPanel — miniatura (Milestone 2.5)", () => {
    it("la fila trae la primera foto como portada, y null si no hay fotos", async () => {
      const category = await seedCategory("panel-img");
      const image = (n: number, alt?: string) => ({
        url: `https://res.cloudinary.com/demo/image/upload/p${n}.jpg`,
        publicId: `demo/p${n}`,
        width: 800,
        height: 800,
        format: "jpg",
        bytes: 1000,
        ...(alt ? { alt } : {}),
      });
      const withPhotos = await Product.create({
        name: "Con Fotos",
        slug: "con-fotos",
        description: "desc",
        categoryId: category._id,
        images: [image(1, "Frasco de frente"), image(2)],
        variants: [variant("IMG-A")],
      });
      const withoutPhotos = await Product.create({
        name: "Sin Fotos",
        slug: "sin-fotos",
        description: "desc",
        categoryId: category._id,
        variants: [variant("IMG-B")],
      });

      const { items } = await listInventoryPanel({ page: 1, limit: 20, sort: { field: "name", direction: "asc" } }, 5);

      expect(items.find((i) => i.productId === withPhotos._id.toString())?.image).toEqual({
        url: "https://res.cloudinary.com/demo/image/upload/p1.jpg",
        alt: "Frasco de frente",
      });
      expect(items.find((i) => i.productId === withoutPhotos._id.toString())?.image).toBeNull();
    });
  });

  describe("listInventoryPanel — categoría (Milestone 2.5)", () => {
    it("cada fila trae su categoría directa con parentId", async () => {
      const root = await seedCategory("panel-cat-root");
      const sub = await Category.create({ name: "Sub Panel", slug: "sub-panel-cat", parentId: root._id });
      const product = await Product.create({
        name: "Producto Con Categoria",
        slug: "producto-con-categoria",
        description: "desc",
        categoryId: sub._id,
        variants: [variant("CAT-A")],
      });

      const { items } = await listInventoryPanel({ page: 1, limit: 20, sort: { field: "name", direction: "asc" } }, 5);

      const row = items.find((i) => i.productId === product._id.toString());
      expect(row?.category).toEqual({
        id: sub._id.toString(),
        name: "Sub Panel",
        slug: "sub-panel-cat",
        parentId: root._id.toString(),
      });
    });

    it("filtrar por una raíz incluye los productos de sus subcategorías y acota statusCounts", async () => {
      const root = await seedCategory("panel-scope-root");
      const sub = await Category.create({ name: "Sub Scope", slug: "sub-scope", parentId: root._id });
      const other = await seedCategory("panel-scope-other");

      const inRoot = await Product.create({
        name: "En La Raiz",
        slug: "en-la-raiz",
        description: "desc",
        categoryId: root._id,
        variants: [variant("SCOPE-ROOT")],
      });
      const inSub = await Product.create({
        name: "En La Sub",
        slug: "en-la-sub",
        description: "desc",
        categoryId: sub._id,
        variants: [variant("SCOPE-SUB")],
      });
      const outside = await Product.create({
        name: "Fuera",
        slug: "fuera-del-scope",
        description: "desc",
        categoryId: other._id,
        variants: [variant("SCOPE-OUT")],
      });
      await Inventory.create({ productId: inSub._id, variantId: inSub.variants[0]!._id, sku: "SCOPE-SUB", onHand: 0, reserved: 0 });
      await Inventory.create({ productId: outside._id, variantId: outside.variants[0]!._id, sku: "SCOPE-OUT", onHand: 0, reserved: 0 });

      const { items, statusCounts, meta } = await listInventoryPanel(
        { page: 1, limit: 20, sort: { field: "name", direction: "asc" }, categoryId: root._id.toString() },
        5,
      );

      expect(items.map((i) => i.productId).sort()).toEqual([inRoot._id.toString(), inSub._id.toString()].sort());
      expect(meta.total).toBe(2);
      expect(statusCounts[StockStatus.OUT]).toBe(1);
      expect(statusCounts[StockStatus.UNTRACKED]).toBe(1);
    });

    it("filtrar por una subcategoría no trae a sus hermanas", async () => {
      const root = await seedCategory("panel-sibling-root");
      const subA = await Category.create({ name: "Sub A", slug: "sub-sibling-a", parentId: root._id });
      const subB = await Category.create({ name: "Sub B", slug: "sub-sibling-b", parentId: root._id });
      const inA = await Product.create({
        name: "En A",
        slug: "en-sub-a",
        description: "desc",
        categoryId: subA._id,
        variants: [variant("SIB-A")],
      });
      await Product.create({
        name: "En B",
        slug: "en-sub-b",
        description: "desc",
        categoryId: subB._id,
        variants: [variant("SIB-B")],
      });

      const { items } = await listInventoryPanel(
        { page: 1, limit: 20, sort: { field: "name", direction: "asc" }, categoryId: subA._id.toString() },
        5,
      );

      expect(items.map((i) => i.productId)).toEqual([inA._id.toString()]);
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
      expect(detail.category?.id).toBe(category._id.toString());
    });

    it("responde 404 si el producto no existe", async () => {
      await expect(getProductInventoryDetail("aaaaaaaaaaaaaaaaaaaaaaaa", 5)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
