import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Inventory } from "../../src/models/inventory.model.js";
import {
  adjustStock,
  ensureInventoryRow,
  getByVariantId,
  listInventory,
} from "../../src/services/inventory.service.js";

function objectId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId();
}

describe("services/inventory", () => {
  describe("ensureInventoryRow", () => {
    it("crea una fila nueva en 0/0", async () => {
      const productId = objectId();
      const variantId = objectId();

      const row = await ensureInventoryRow({ productId, variantId, sku: "SKU-NEW" });

      expect(row.onHand).toBe(0);
      expect(row.reserved).toBe(0);
      expect(row.sku).toBe("SKU-NEW");
    });

    it("es idempotente: llamarlo dos veces con el mismo variantId deja una sola fila", async () => {
      const productId = objectId();
      const variantId = objectId();

      await ensureInventoryRow({ productId, variantId, sku: "SKU-IDEMP" });
      await ensureInventoryRow({ productId, variantId, sku: "SKU-IDEMP" });

      const count = await Inventory.countDocuments({ variantId });
      expect(count).toBe(1);
    });
  });

  describe("adjustStock", () => {
    it("suma stock con un delta positivo", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-1", onHand: 0, reserved: 0 });

      const row = await adjustStock({ variantId: variantId.toString(), delta: 10 });

      expect(row.onHand).toBe(10);
    });

    it("resta stock con un delta negativo cuando no hay nada reservado", async () => {
      const variantId = objectId();
      await Inventory.create({ productId: objectId(), variantId, sku: "SKU-ADJ-2", onHand: 10, reserved: 0 });

      const row = await adjustStock({ variantId: variantId.toString(), delta: -3 });

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
  });

  describe("getByVariantId", () => {
    it("responde 404 para una variante sin fila de inventario", async () => {
      await expect(getByVariantId(objectId().toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("listInventory — lowStock", () => {
    it("filtra por disponible (onHand - reserved), no por onHand a secas", async () => {
      const productId = objectId();
      // available = 3, bajo
      await Inventory.create({
        productId,
        variantId: objectId(),
        sku: "LOW-A",
        onHand: 3,
        reserved: 0,
      });
      // available = 2, bajo — pero onHand es alto: un filtro ingenuo por
      // onHand<=threshold lo perdería.
      await Inventory.create({
        productId,
        variantId: objectId(),
        sku: "LOW-B",
        onHand: 10,
        reserved: 8,
      });
      // available = 20, no está bajo
      await Inventory.create({
        productId,
        variantId: objectId(),
        sku: "HIGH-C",
        onHand: 20,
        reserved: 0,
      });

      const { rows } = await listInventory(
        { page: 1, limit: 20, sort: { field: "updatedAt", direction: "desc" }, lowStock: true },
        5,
      );

      const skus = rows.map((row) => row.sku).sort();
      expect(skus).toEqual(["LOW-A", "LOW-B"]);
    });
  });
});
