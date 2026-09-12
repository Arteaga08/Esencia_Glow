import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import {
  adjustStock,
  createInventoryItem,
  getByVariantId,
  seedInitialStock,
  updateLowStockThreshold,
} from "../../src/services/inventory.service.js";

function objectId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId();
}

async function seedProductWithVariant(sku: string) {
  const category = await Category.create({ name: `Cat ${sku}`, slug: `cat-${sku.toLowerCase()}` });
  const product = await Product.create({
    name: `Producto ${sku}`,
    slug: `producto-${sku.toLowerCase()}`,
    description: "desc",
    categoryId: category._id,
    variants: [
      { sku, name: "Variante", price: 1000, weightGrams: 100, dimensionsCm: { length: 1, width: 1, height: 1 } },
    ],
  });
  return { product, variantId: product.variants[0]!._id };
}

describe("services/inventory", () => {
  describe("createInventoryItem", () => {
    it("crea la fila resolviendo el SKU desde el catálogo, nunca del cliente", async () => {
      const { product, variantId } = await seedProductWithVariant("SKU-CREATE");

      const row = await createInventoryItem({
        productId: product._id.toString(),
        variantId: variantId.toString(),
        onHand: 20,
      });

      expect(row.sku).toBe("SKU-CREATE");
      expect(row.onHand).toBe(20);
      expect(row.reserved).toBe(0);
    });

    it("acepta un lowStockThreshold opcional", async () => {
      const { product, variantId } = await seedProductWithVariant("SKU-THRESH");

      const row = await createInventoryItem({
        productId: product._id.toString(),
        variantId: variantId.toString(),
        onHand: 5,
        lowStockThreshold: 2,
      });

      expect(row.lowStockThreshold).toBe(2);
    });

    it("responde 404 si la variante no pertenece al producto", async () => {
      const { product } = await seedProductWithVariant("SKU-A");
      const { variantId: foreignVariantId } = await seedProductWithVariant("SKU-B");

      await expect(
        createInventoryItem({
          productId: product._id.toString(),
          variantId: foreignVariantId.toString(),
          onHand: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("responde 409 si ya existe una fila para esa variante", async () => {
      const { product, variantId } = await seedProductWithVariant("SKU-DUP");
      await createInventoryItem({ productId: product._id.toString(), variantId: variantId.toString(), onHand: 1 });

      await expect(
        createInventoryItem({ productId: product._id.toString(), variantId: variantId.toString(), onHand: 2 }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("seedInitialStock", () => {
    it("solo siembra las variantes con stock > 0 en el mapa dado", async () => {
      const category = await Category.create({ name: "Cat Seed", slug: "cat-seed" });
      const product = await Product.create({
        name: "Producto Seed",
        slug: "producto-seed",
        description: "desc",
        categoryId: category._id,
        variants: [
          { sku: "SEED-A", name: "A", price: 100, weightGrams: 10, dimensionsCm: { length: 1, width: 1, height: 1 } },
          { sku: "SEED-B", name: "B", price: 100, weightGrams: 10, dimensionsCm: { length: 1, width: 1, height: 1 } },
        ],
      });
      const stockBySku = new Map([["SEED-A", 7]]);

      await seedInitialStock(product, stockBySku);

      const rows = await Inventory.find({ productId: product._id }).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sku).toBe("SEED-A");
      expect(rows[0]?.onHand).toBe(7);
    });

    it("con el mapa vacío no siembra nada", async () => {
      const category = await Category.create({ name: "Cat Seed 2", slug: "cat-seed-2" });
      const product = await Product.create({
        name: "Producto Seed 2",
        slug: "producto-seed-2",
        description: "desc",
        categoryId: category._id,
        variants: [
          { sku: "SEED-C", name: "A", price: 100, weightGrams: 10, dimensionsCm: { length: 1, width: 1, height: 1 } },
        ],
      });

      await seedInitialStock(product, new Map());

      expect(await Inventory.countDocuments({ productId: product._id })).toBe(0);
    });
  });

  describe("adjustStock", () => {
    it("suma stock con un delta positivo", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-1", onHand: 0, reserved: 0 });

      const { row } = await adjustStock({ variantId: variantId.toString(), delta: 10 });

      expect(row.onHand).toBe(10);
    });

    it("resta stock con un delta negativo cuando no hay nada reservado", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-2", onHand: 10, reserved: 0 });

      const { row } = await adjustStock({ variantId: variantId.toString(), delta: -3 });

      expect(row.onHand).toBe(7);
    });

    it("rechaza con 409 un delta que dejaría onHand por debajo de lo reservado, y no muta el documento", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-3", onHand: 10, reserved: 5 });

      await expect(
        adjustStock({ variantId: variantId.toString(), delta: -8 }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(10);
      expect(row?.reserved).toBe(5);
    });

    it("responde 404 si la variante no existe en el inventario", async () => {
      await expect(
        adjustStock({ variantId: objectId().toString(), delta: 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("responde 409 si expectedOnHand ya no coincide (guarda optimista)", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-4", onHand: 10, reserved: 0 });

      await expect(
        adjustStock({ variantId: variantId.toString(), delta: 5, expectedOnHand: 3 }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(10);
    });

    it("un delta positivo mueve lastRestockedAt", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-5", onHand: 0, reserved: 0 });

      const { row } = await adjustStock({ variantId: variantId.toString(), delta: 10 });

      expect(row.lastRestockedAt).toBeInstanceOf(Date);
    });

    it("un delta negativo NO mueve lastRestockedAt", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-6", onHand: 10, reserved: 0 });

      const { row } = await adjustStock({ variantId: variantId.toString(), delta: -3 });

      expect(row.lastRestockedAt).toBeUndefined();
    });

    it("devuelve before/after", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-7", onHand: 10, reserved: 0 });

      const { before, after } = await adjustStock({ variantId: variantId.toString(), delta: 5 });

      expect(before).toBe(10);
      expect(after).toBe(15);
    });

    it("recuento absoluto (onHand) fija el valor sin mover lastRestockedAt", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-8", onHand: 10, reserved: 2 });

      const { row, before, after } = await adjustStock({ variantId: variantId.toString(), onHand: 20 });

      expect(row.onHand).toBe(20);
      expect(row.lastRestockedAt).toBeUndefined();
      expect(before).toBe(10);
      expect(after).toBe(20);
    });

    it("un recuento por debajo de lo reservado responde 409 y no muta", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-9", onHand: 10, reserved: 5 });

      await expect(
        adjustStock({ variantId: variantId.toString(), onHand: 3 }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(10);
    });

    it("no hace una segunda lectura para construir la fila devuelta: la respuesta sale del mismo write atómico", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-10", onHand: 10, reserved: 0 });

      const findOneSpy = vi.spyOn(Inventory, "findOne");

      const { row, before, after } = await adjustStock({ variantId: variantId.toString(), delta: 5 });

      expect(findOneSpy).not.toHaveBeenCalled();
      expect(before).toBe(10);
      expect(after).toBe(15);
      expect(row.onHand).toBe(15);
      expect(row.lastRestockedAt).toBeInstanceOf(Date);

      findOneSpy.mockRestore();
    });
  });

  describe("getByVariantId", () => {
    it("responde 404 para una variante sin fila de inventario", async () => {
      await expect(getByVariantId(objectId().toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("updateLowStockThreshold", () => {
    it("fija el override por SKU", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-THR-1", onHand: 10, reserved: 0 });

      const row = await updateLowStockThreshold(variantId.toString(), 3);

      expect(row.lowStockThreshold).toBe(3);
    });

    it("null quita el override (vuelve a usar el default global)", async () => {
      const variantId = objectId();
      await Inventory.create({
        productId: objectId(),
        variantId,
        sku: "SKU-THR-2",
        onHand: 10,
        reserved: 0,
        lowStockThreshold: 3,
      });

      const row = await updateLowStockThreshold(variantId.toString(), null);

      expect(row.lowStockThreshold).toBeUndefined();
    });

    it("responde 404 si la variante no existe en el inventario", async () => {
      await expect(updateLowStockThreshold(objectId().toString(), 3)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
