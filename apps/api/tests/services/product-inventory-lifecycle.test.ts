import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createProduct } from "../../src/services/product.service.js";
import { addVariant, removeVariant, updateVariant } from "../../src/services/product-variant.service.js";

function sampleVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sku: overrides.sku ?? "SER-30ML",
    name: "30 ml",
    price: 34900,
    weightGrams: 150,
    dimensionsCm: { length: 5, width: 5, height: 10 },
    ...overrides,
  };
}

async function seedCategory(suffix: string) {
  return Category.create({ name: `Cat ${suffix}`, slug: `cat-${suffix}` });
}

describe("product <-> inventory (ciclo de vida)", () => {
  describe("createProduct — alta de stock híbrida", () => {
    it("sin initialStock, ninguna variante siembra fila de inventario", async () => {
      const category = await seedCategory("create-1");

      const product = await createProduct({
        name: "Rutina Completa",
        description: "Set de skincare",
        categoryId: category._id.toString(),
        variants: [
          sampleVariant({ sku: "RC-A" }),
          sampleVariant({ sku: "RC-B" }),
          sampleVariant({ sku: "RC-C" }),
        ],
      });

      const rows = await Inventory.find({ productId: product._id }).lean();
      expect(rows).toHaveLength(0);
    });

    it("solo siembra fila para las variantes con initialStock > 0, y con ese onHand", async () => {
      const category = await seedCategory("create-2");

      const product = await createProduct({
        name: "Rutina Parcial",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [
          sampleVariant({ sku: "RP-A", initialStock: 10 }),
          sampleVariant({ sku: "RP-B", initialStock: 0 }),
          sampleVariant({ sku: "RP-C" }),
        ],
      });

      const rows = await Inventory.find({ productId: product._id }).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sku).toBe("RP-A");
      expect(rows[0]?.onHand).toBe(10);
      expect(rows[0]?.reserved).toBe(0);
    });

    it("initialStock nunca se persiste en Product.variants", async () => {
      const category = await seedCategory("create-3");

      const product = await createProduct({
        name: "Producto Write Only",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [sampleVariant({ sku: "WO-A", initialStock: 5 })],
      });

      const reloaded = await Product.findById(product._id).lean();
      expect(reloaded?.variants[0]).not.toHaveProperty("initialStock");
    });

    it("si la siembra de inventario falla, no queda ni producto ni filas (todo revierte)", async () => {
      const category = await seedCategory("create-4");
      // Fila de inventario preexistente con un sku que una nueva variante
      // reutilizará — sin producto dueño, simula una inconsistencia que hace
      // fallar la unicidad DESPUÉS de que product.save() ya tuvo éxito.
      await Inventory.create({
        productId: new mongoose.Types.ObjectId(),
        variantId: new mongoose.Types.ObjectId(),
        sku: "DUP-SKU",
        onHand: 0,
        reserved: 0,
      });

      await expect(
        createProduct({
          name: "Producto Conflictivo",
          description: "desc",
          categoryId: category._id.toString(),
          variants: [sampleVariant({ sku: "DUP-SKU", initialStock: 3 })],
        }),
      ).rejects.toBeDefined();

      expect(await Product.countDocuments({ name: "Producto Conflictivo" })).toBe(0);
    });
  });

  describe("addVariant", () => {
    it("no siembra fila de inventario para la variante nueva", async () => {
      const category = await seedCategory("add-1");
      const product = await createProduct({
        name: "Producto Base",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [sampleVariant({ sku: "BASE-A" })],
      });

      const updated = await addVariant(product._id.toString(), sampleVariant({ sku: "BASE-B" }));
      const newVariant = updated.variants.find((v) => v.sku === "BASE-B")!;

      const row = await Inventory.findOne({ variantId: newVariant._id });
      expect(row).toBeNull();
    });
  });

  describe("updateVariant", () => {
    it("propaga un cambio de sku a la fila de inventario si existe", async () => {
      const category = await seedCategory("upd-1");
      const product = await createProduct({
        name: "Producto Sku",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [sampleVariant({ sku: "OLD-SKU", initialStock: 1 })],
      });
      const variantId = product.variants[0]!._id;

      await updateVariant(product._id.toString(), variantId.toString(), { sku: "NEW-SKU" });

      const row = await Inventory.findOne({ variantId });
      expect(row?.sku).toBe("NEW-SKU");
    });

    it("sin cambio de sku no abre una transacción nueva", async () => {
      const category = await seedCategory("upd-2");
      const product = await createProduct({
        name: "Producto Sin Cambio",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [sampleVariant({ sku: "STAY-SKU" })],
      });
      const variantId = product.variants[0]!._id;

      const startSessionSpy = vi.spyOn(mongoose, "startSession");

      await updateVariant(product._id.toString(), variantId.toString(), { name: "Nuevo nombre" });

      expect(startSessionSpy).not.toHaveBeenCalled();
      startSessionSpy.mockRestore();
    });
  });

  describe("removeVariant", () => {
    it("responde 409 y no borra nada si la variante tiene unidades reservadas", async () => {
      const category = await seedCategory("rm-1");
      const product = await createProduct({
        name: "Producto Reservado",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [sampleVariant({ sku: "RES-SKU" })],
      });
      const variantId = product.variants[0]!._id;
      await Inventory.create({ productId: product._id, variantId, sku: "RES-SKU", onHand: 5, reserved: 2 });

      await expect(
        removeVariant(product._id.toString(), variantId.toString()),
      ).rejects.toMatchObject({ statusCode: 409 });

      const reloaded = await Product.findById(product._id);
      expect(reloaded?.variants.id(variantId)).not.toBeNull();
      expect(await Inventory.findOne({ variantId })).not.toBeNull();
    });

    it("con reserved en 0 elimina la variante y su fila de inventario, y recalcula minPrice", async () => {
      const category = await seedCategory("rm-2");
      const product = await createProduct({
        name: "Producto Dos Variantes",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [
          sampleVariant({ sku: "CHEAP", price: 100, initialStock: 1 }),
          sampleVariant({ sku: "PRICEY", price: 999 }),
        ],
      });
      const cheapVariantId = product.variants.find((v) => v.sku === "CHEAP")!._id;

      const updated = await removeVariant(product._id.toString(), cheapVariantId.toString());

      expect(updated.variants.id(cheapVariantId)).toBeNull();
      expect(await Inventory.findOne({ variantId: cheapVariantId })).toBeNull();
      expect(updated.minPrice).toBe(999);
    });

    it("elimina la variante sin fila de inventario sin fallar", async () => {
      const category = await seedCategory("rm-3");
      const product = await createProduct({
        name: "Producto Sin Fila",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [sampleVariant({ sku: "NOROW", price: 100 }), sampleVariant({ sku: "OTHER", price: 200 })],
      });
      const variantId = product.variants.find((v) => v.sku === "NOROW")!._id;

      const updated = await removeVariant(product._id.toString(), variantId.toString());

      expect(updated.variants.id(variantId)).toBeNull();
    });
  });
});
