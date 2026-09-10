import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Inventory } from "../../src/models/inventory.model.js";

describe("models/Inventory", () => {
  function buildRow(
    overrides: Partial<{ variantId: mongoose.Types.ObjectId; sku: string; onHand: number }> = {},
  ) {
    return {
      productId: new mongoose.Types.ObjectId(),
      variantId: overrides.variantId ?? new mongoose.Types.ObjectId(),
      sku: overrides.sku ?? "SER-30ML",
      onHand: overrides.onHand ?? 10,
      reserved: 0,
    };
  }

  it("rechaza un variantId duplicado (11000)", async () => {
    const variantId = new mongoose.Types.ObjectId();
    await Inventory.create(buildRow({ variantId, sku: "SKU-A" }));

    await expect(Inventory.create(buildRow({ variantId, sku: "SKU-B" }))).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("rechaza un sku duplicado (11000)", async () => {
    await Inventory.create(buildRow({ sku: "SKU-DUP" }));

    await expect(Inventory.create(buildRow({ sku: "SKU-DUP" }))).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("demuestra por qué min:0 en el schema NO protege bajo $inc: un findOneAndUpdate sin guarda $expr deja onHand negativo", async () => {
    const row = await Inventory.create(buildRow({ onHand: 5 }));

    const updated = await Inventory.findOneAndUpdate(
      { _id: row._id },
      { $inc: { onHand: -100 } },
      { new: true },
    );

    // Esto NO es el comportamiento deseado del sistema — es la prueba de que
    // la validación del schema (min:0) es inerte frente a $inc, y por eso la
    // única invariante real es el $expr en inventory.service.ts.
    expect(updated?.onHand).toBe(-95);
  });
});
