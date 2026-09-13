import { ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { createProduct, updateProduct } from "../../src/services/product.service.js";
import { removeVariant } from "../../src/services/product-variant.service.js";
import { createEdition, updateEdition } from "../../src/services/subscription-edition.service.js";
import { publishEdition } from "../../src/services/subscription-edition-publish.service.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";

function sampleVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sku: overrides.sku ?? "EDREF-A",
    name: "30 ml",
    price: 34900,
    weightGrams: 150,
    dimensionsCm: { length: 5, width: 5, height: 10 },
    ...overrides,
  };
}

let seedCounter = 0;

async function seedPlan() {
  seedCounter += 1;
  return SubscriptionPlan.create({
    name: `Plan Ref ${seedCounter}`,
    slug: `plan-ref-${seedCounter}`,
    description: "d",
    priceCents: 49900,
    maxActiveSeats: 100,
  });
}

describe("product-variant <-> subscription-edition (integridad referencial)", () => {
  it("removeVariant responde 409 si una edición PUBLICADA usa esa variante, y no borra nada", async () => {
    const category = await Category.create({ name: "Cat EdRef 1", slug: "cat-edref-1" });
    const product = await createProduct({
      name: "Producto Curado",
      description: "desc",
      categoryId: category._id.toString(),
      channel: ProductChannel.SUBSCRIPTION,
      variants: [sampleVariant({ initialStock: 5 })],
    });
    await updateProduct(product._id.toString(), { status: ProductStatus.ACTIVE });
    const variantId = product.variants[0]!._id;

    const plan = await seedPlan();
    const edition = await createEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      title: "Sept",
    });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    await publishEdition(edition._id.toString(), plan._id.toString());

    await expect(
      removeVariant(product._id.toString(), variantId.toString()),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await Inventory.findOne({ variantId })).not.toBeNull();
  });

  it("una variante usada solo por una edición en DRAFT (sin publicar) sigue siendo eliminable", async () => {
    const category = await Category.create({ name: "Cat EdRef 2", slug: "cat-edref-2" });
    const product = await createProduct({
      name: "Producto Curado Draft",
      description: "desc",
      categoryId: category._id.toString(),
      channel: ProductChannel.SUBSCRIPTION,
      variants: [sampleVariant({ sku: "EDREF-B" })],
    });
    const variantId = product.variants[0]!._id;

    const plan = await seedPlan();
    const edition = await createEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 10,
      title: "Oct",
    });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    const updated = await removeVariant(product._id.toString(), variantId.toString());
    expect(updated.variants.id(variantId)).toBeNull();
  });
});
