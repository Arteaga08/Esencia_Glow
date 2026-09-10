import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createProduct } from "../../src/services/product.service.js";
import { addVariant, removeVariant, updateVariant } from "../../src/services/product-variant.service.js";
import { backfillInventory } from "../../src/scripts/backfill-inventory.js";

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
  describe("createProduct", () => {
    it("crea una fila de inventario en 0/0 por cada variante", async () => {
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
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.onHand).toBe(0);
        expect(row.reserved).toBe(0);
      }
      const skus = rows.map((r) => r.sku).sort();
      expect(skus).toEqual(["RC-A", "RC-B", "RC-C"]);
    });

    it("si la creación de inventario falla, no queda ni producto ni filas (todo revierte)", async () => {
      const category = await seedCategory("create-2");
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
          variants: [sampleVariant({ sku: "DUP-SKU" })],
        }),
      ).rejects.toBeDefined();

      expect(await Product.countDocuments({ name: "Producto Conflictivo" })).toBe(0);
    });
  });

  describe("addVariant", () => {
    it("crea la fila de inventario de la variante nueva", async () => {
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
      expect(row).not.toBeNull();
      expect(row?.onHand).toBe(0);
    });
  });

  describe("updateVariant", () => {
    it("propaga un cambio de sku a la fila de inventario", async () => {
      const category = await seedCategory("upd-1");
      const product = await createProduct({
        name: "Producto Sku",
        description: "desc",
        categoryId: category._id.toString(),
        variants: [sampleVariant({ sku: "OLD-SKU" })],
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
      await Inventory.updateOne({ variantId }, { $set: { onHand: 5, reserved: 2 } });

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
        variants: [sampleVariant({ sku: "CHEAP", price: 100 }), sampleVariant({ sku: "PRICEY", price: 999 })],
      });
      const cheapVariantId = product.variants.find((v) => v.sku === "CHEAP")!._id;

      const updated = await removeVariant(product._id.toString(), cheapVariantId.toString());

      expect(updated.variants.id(cheapVariantId)).toBeNull();
      expect(await Inventory.findOne({ variantId: cheapVariantId })).toBeNull();
      expect(updated.minPrice).toBe(999);
    });
  });

  describe("backfillInventory", () => {
    it("crea una fila por variante para productos preexistentes sin inventario, y es idempotente", async () => {
      const category = await seedCategory("backfill-1");
      // Producto insertado sin pasar por createProduct (simula datos previos
      // a 1.4, sin ninguna fila de Inventory asociada).
      await Product.create({
        name: "Producto Legado",
        slug: "producto-legado",
        description: "desc",
        categoryId: category._id,
        variants: [sampleVariant({ sku: "LEGACY-A" }), sampleVariant({ sku: "LEGACY-B" })],
      });

      const first = await backfillInventory();
      expect(first.rowsEnsured).toBe(2);
      expect(await Inventory.countDocuments()).toBe(2);

      const second = await backfillInventory();
      expect(second.rowsEnsured).toBe(2);
      expect(await Inventory.countDocuments()).toBe(2);
    });
  });
});
