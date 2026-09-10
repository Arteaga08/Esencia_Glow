import mongoose from "mongoose";
import { BundleStatus, ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { createBundle, updateBundle } from "../../src/services/bundle.service.js";
import { reserveBundleStock } from "../../src/services/bundle-reservation.service.js";

let seedCounter = 0;

async function seedVariant(onHand = 10) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat ${suffix}`, slug: `cat-${suffix}` });
  const variantId = new mongoose.Types.ObjectId();
  const sku = `SKU-${suffix}`;

  const product = await Product.create({
    name: `Producto ${suffix}`,
    slug: `producto-${suffix}`,
    description: "Descripción de prueba",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        _id: variantId,
        sku,
        name: "Variante única",
        price: 1000,
        weightGrams: 100,
        dimensionsCm: { length: 1, width: 1, height: 1 },
        isActive: true,
      },
    ],
  });

  await Inventory.create({ productId: product._id, variantId, sku, onHand, reserved: 0 });
  return { productId: product._id.toString(), variantId: variantId.toString(), sku };
}

async function seedActiveBundle(items: { productId: string; variantId: string; quantity: number }[]) {
  const bundle = await createBundle({
    name: `Bundle ${Date.now()}-${Math.random()}`,
    description: "desc",
    price: 1000,
    items,
  });
  return updateBundle(bundle._id.toString(), { status: BundleStatus.ACTIVE });
}

describe("services/bundle-reservation — reserveBundleStock", () => {
  it("expande el bundle a líneas por variante (quantity del item × cantidad pedida)", async () => {
    const a = await seedVariant(10);
    const b = await seedVariant(10);
    const bundle = await seedActiveBundle([
      { productId: a.productId, variantId: a.variantId, quantity: 1 },
      { productId: b.productId, variantId: b.variantId, quantity: 2 },
    ]);

    const reservation = await reserveBundleStock({
      bundleId: bundle._id.toString(),
      quantity: 3,
      cartRef: "cart-bundle-1",
      ttlMinutes: 30,
    });

    const lineFor = (variantId: string) =>
      reservation.lines.find((line) => line.variantId.toString() === variantId);
    expect(lineFor(a.variantId)?.quantity).toBe(3); // 1 * 3
    expect(lineFor(b.variantId)?.quantity).toBe(6); // 2 * 3

    const rowA = await Inventory.findOne({ variantId: a.variantId });
    const rowB = await Inventory.findOne({ variantId: b.variantId });
    expect(rowA?.reserved).toBe(3);
    expect(rowB?.reserved).toBe(6);
  });

  it("registra sourceBundles para trazabilidad, sin afectar los $inc de Inventory", async () => {
    const a = await seedVariant(10);
    const bundle = await seedActiveBundle([{ productId: a.productId, variantId: a.variantId, quantity: 1 }]);

    const reservation = await reserveBundleStock({
      bundleId: bundle._id.toString(),
      quantity: 2,
      cartRef: "cart-bundle-2",
      ttlMinutes: 30,
    });

    expect(reservation.sourceBundles).toHaveLength(1);
    expect(reservation.sourceBundles?.[0]?.bundleId.toString()).toBe(bundle._id.toString());
    expect(reservation.sourceBundles?.[0]?.quantity).toBe(2);
  });

  it("si un componente no alcanza, revierte todo (ningún componente queda parcialmente reservado)", async () => {
    const generous = await seedVariant(100);
    const scarce = await seedVariant(2);
    const bundle = await seedActiveBundle([
      { productId: generous.productId, variantId: generous.variantId, quantity: 1 },
      { productId: scarce.productId, variantId: scarce.variantId, quantity: 1 },
    ]);

    await expect(
      reserveBundleStock({
        bundleId: bundle._id.toString(),
        quantity: 5, // pide 5, pero "scarce" solo tiene 2
        cartRef: "cart-bundle-3",
        ttlMinutes: 30,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const rowGenerous = await Inventory.findOne({ variantId: generous.variantId });
    const rowScarce = await Inventory.findOne({ variantId: scarce.variantId });
    expect(rowGenerous?.reserved).toBe(0);
    expect(rowScarce?.reserved).toBe(0);
    expect(await StockReservation.countDocuments({ cartRef: "cart-bundle-3" })).toBe(0);
  });

  it("un bundle en draft no es reservable", async () => {
    const a = await seedVariant(10);
    const bundle = await createBundle({
      name: "Bundle Draft",
      description: "desc",
      price: 1000,
      items: [{ productId: a.productId, variantId: a.variantId, quantity: 1 }],
    });

    await expect(
      reserveBundleStock({
        bundleId: bundle._id.toString(),
        quantity: 1,
        cartRef: "cart-bundle-draft",
        ttlMinutes: 30,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("cantidad 0 o negativa responde 400", async () => {
    const a = await seedVariant(10);
    const bundle = await seedActiveBundle([{ productId: a.productId, variantId: a.variantId, quantity: 1 }]);

    await expect(
      reserveBundleStock({ bundleId: bundle._id.toString(), quantity: 0, cartRef: "cart-bundle-4", ttlMinutes: 30 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
