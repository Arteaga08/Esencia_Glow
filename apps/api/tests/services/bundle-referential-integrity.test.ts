import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { createProduct } from "../../src/services/product.service.js";
import { addVariant, removeVariant } from "../../src/services/product-variant.service.js";
import { createBundle } from "../../src/services/bundle.service.js";

function sampleVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sku: overrides.sku ?? "REF-A",
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

describe("product-variant <-> bundle (integridad referencial)", () => {
  it("removeVariant responde 409 si un bundle usa esa variante, y no borra nada", async () => {
    const category = await seedCategory("ref-1");
    const product = await createProduct({
      name: "Producto Referenciado",
      description: "desc",
      categoryId: category._id.toString(),
      variants: [sampleVariant()],
    });
    const variantId = product.variants[0]!._id;

    await createBundle({
      name: "Bundle Dependiente",
      description: "desc",
      price: 1000,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    await expect(
      removeVariant(product._id.toString(), variantId.toString()),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await Inventory.findOne({ variantId })).not.toBeNull();
  });

  it("una variante que ningún bundle usa se elimina normalmente", async () => {
    const category = await seedCategory("ref-2");
    const product = await createProduct({
      name: "Producto Libre",
      description: "desc",
      categoryId: category._id.toString(),
      variants: [sampleVariant({ sku: "REF-B" })],
    });
    const variantId = product.variants[0]!._id;

    const updated = await removeVariant(product._id.toString(), variantId.toString());
    expect(updated.variants.id(variantId)).toBeNull();
  });

  it("eliminar una variante distinta a la usada por el bundle sigue permitida", async () => {
    const category = await seedCategory("ref-3");
    const product = await createProduct({
      name: "Producto Dos Variantes",
      description: "desc",
      categoryId: category._id.toString(),
      variants: [sampleVariant({ sku: "REF-C1" })],
    });
    const updated = await addVariant(product._id.toString(), sampleVariant({ sku: "REF-C2" }));
    const usedVariantId = updated.variants.find((v) => v.sku === "REF-C1")!._id;
    const freeVariantId = updated.variants.find((v) => v.sku === "REF-C2")!._id;

    await createBundle({
      name: "Bundle Parcial",
      description: "desc",
      price: 1000,
      items: [{ productId: product._id.toString(), variantId: usedVariantId.toString(), quantity: 1 }],
    });

    const result = await removeVariant(product._id.toString(), freeVariantId.toString());
    expect(result.variants.id(freeVariantId)).toBeNull();
    expect(result.variants.id(usedVariantId)).not.toBeNull();
  });
});
