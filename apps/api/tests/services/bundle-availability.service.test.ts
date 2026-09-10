import mongoose from "mongoose";
import { ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { computeBundleAvailability } from "../../src/services/bundle-availability.service.js";

let seedCounter = 0;

async function seedVariant(
  opts: { onHand?: number; reserved?: number; isActive?: boolean; productStatus?: ProductStatus } = {},
) {
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
    status: opts.productStatus ?? ProductStatus.ACTIVE,
    variants: [
      {
        _id: variantId,
        sku,
        name: "Variante única",
        price: 1000,
        weightGrams: 100,
        dimensionsCm: { length: 1, width: 1, height: 1 },
        isActive: opts.isActive ?? true,
      },
    ],
  });

  await Inventory.create({
    productId: product._id,
    variantId,
    sku,
    onHand: opts.onHand ?? 10,
    reserved: opts.reserved ?? 0,
  });

  return { productId: product._id, variantId, sku };
}

describe("services/bundle-availability — computeBundleAvailability", () => {
  it("un solo componente: floor(available/quantity)", async () => {
    const { productId, variantId } = await seedVariant({ onHand: 10, reserved: 1 });

    const availability = await computeBundleAvailability([
      { productId, variantId, quantity: 3 },
    ]);

    expect(availability).toBe(3); // floor(9/3)
  });

  it("varios componentes: el mínimo entre ellos manda", async () => {
    const generous = await seedVariant({ onHand: 100 });
    const scarce = await seedVariant({ onHand: 4 });

    const availability = await computeBundleAvailability([
      { productId: generous.productId, variantId: generous.variantId, quantity: 1 },
      { productId: scarce.productId, variantId: scarce.variantId, quantity: 2 },
    ]);

    expect(availability).toBe(2); // floor(4/2)=2 domina sobre floor(100/1)=100
  });

  it("una variante inactiva cuenta como disponibilidad 0", async () => {
    const { productId, variantId } = await seedVariant({ onHand: 10, isActive: false });

    const availability = await computeBundleAvailability([{ productId, variantId, quantity: 1 }]);

    expect(availability).toBe(0);
  });

  it("un producto archivado cuenta como disponibilidad 0", async () => {
    const { productId, variantId } = await seedVariant({ onHand: 10, productStatus: ProductStatus.ARCHIVED });

    const availability = await computeBundleAvailability([{ productId, variantId, quantity: 1 }]);

    expect(availability).toBe(0);
  });

  it("reserved >= onHand nunca da negativo", async () => {
    const { productId, variantId } = await seedVariant({ onHand: 5, reserved: 5 });

    const availability = await computeBundleAvailability([{ productId, variantId, quantity: 1 }]);

    expect(availability).toBe(0);
  });

  it("sin items devuelve 0", async () => {
    expect(await computeBundleAvailability([])).toBe(0);
  });
});
