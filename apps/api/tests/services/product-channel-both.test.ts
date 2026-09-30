import { BundleStatus, EditionStatus, ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Bundle } from "../../src/models/bundle.model.js";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { SubscriptionEdition } from "../../src/models/subscription-edition.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { resolveCartLines } from "../../src/services/cart-resolution.service.js";
import { assertItemsValid } from "../../src/services/bundle.service.js";
import { updateProduct } from "../../src/services/product.service.js";
import { createEdition, updateEdition } from "../../src/services/subscription-edition.service.js";
import { publishEdition } from "../../src/services/subscription-edition-publish.service.js";
import { buildProductFilter } from "../../src/utils/build-product-filter.js";

/**
 * Canal "ambos" (Milestone 2.7c): un producto `channel: BOTH` se vende en la
 * tienda Y puede ir en la caja de suscripción. Comparte variantes e
 * inventario; un faltante al cobrar ya se reporta como `inventoryIncident`.
 */

let seedCounter = 0;

async function seedProduct(channel: ProductChannel) {
  seedCounter += 1;
  const category = await Category.create({ name: `Cat B${seedCounter}`, slug: `cat-b${seedCounter}` });
  const product = await Product.create({
    name: `Producto B${seedCounter}`,
    slug: `producto-b${seedCounter}`,
    description: "Descripción de prueba",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    channel,
    variants: [
      {
        sku: `SKU-B${seedCounter}`,
        name: `Variante B${seedCounter}`,
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  return { product, variantId: product.variants[0]!._id };
}

async function seedPlan() {
  seedCounter += 1;
  return SubscriptionPlan.create({
    name: `Plan B${seedCounter}`,
    slug: `plan-b${seedCounter}`,
    description: "d",
    priceCents: 49900,
    maxActiveSeats: 10,
  });
}

describe("services/product-channel-both — producto en tienda y suscripción", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  it("el catálogo público muestra un producto de canal ambos", async () => {
    await seedProduct(ProductChannel.BOTH);
    const visible = await Product.find(buildProductFilter({ publicOnly: true })).lean();
    expect(visible).toHaveLength(1);
  });

  it("resolveCartLines resuelve una línea de producto de canal ambos", async () => {
    const { variantId } = await seedProduct(ProductChannel.BOTH);
    const [line] = await resolveCartLines([{ itemType: "product", itemId: variantId.toString(), quantity: 1 }]);
    expect(line!.itemType).toBe("product");
  });

  it("assertItemsValid acepta un componente de canal ambos en un paquete", async () => {
    const { product, variantId } = await seedProduct(ProductChannel.BOTH);
    await expect(
      assertItemsValid([{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }]),
    ).resolves.toBeUndefined();
  });

  it("publicar una edición con un producto de canal ambos funciona", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct(ProductChannel.BOTH);
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    const published = await publishEdition(edition._id.toString(), plan._id.toString());
    expect(published.status).toBe(EditionStatus.PUBLISHED);
  });

  it("publicar una edición con un producto solo de tienda sigue respondiendo 400", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct(ProductChannel.STORE);
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    await expect(publishEdition(edition._id.toString(), plan._id.toString())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("availableIn=store excluye solo-suscripción e incluye tienda y ambos", async () => {
    await seedProduct(ProductChannel.STORE);
    await seedProduct(ProductChannel.SUBSCRIPTION);
    await seedProduct(ProductChannel.BOTH);

    const found = await Product.find(buildProductFilter({ availableIn: "store" })).lean();
    expect(found.map((p) => p.channel).sort()).toEqual([ProductChannel.BOTH, ProductChannel.STORE]);
  });

  it("availableIn=subscription incluye solo-suscripción y ambos", async () => {
    await seedProduct(ProductChannel.STORE);
    await seedProduct(ProductChannel.SUBSCRIPTION);
    await seedProduct(ProductChannel.BOTH);

    const found = await Product.find(buildProductFilter({ availableIn: "subscription" })).lean();
    expect(found.map((p) => p.channel).sort()).toEqual([ProductChannel.BOTH, ProductChannel.SUBSCRIPTION]);
  });

  it("availableIn=store incluye un producto legado sin el campo channel", async () => {
    const category = await Category.create({ name: "Cat Legado", slug: "cat-legado" });
    await Product.collection.insertOne({
      name: "Legado",
      slug: "legado",
      description: "d",
      categoryId: category._id,
      status: ProductStatus.ACTIVE,
      images: [],
      variants: [],
      minPrice: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const found = await Product.find(buildProductFilter({ availableIn: "store" })).lean();
    expect(found.map((p) => p.slug)).toContain("legado");
  });

  describe("cambios de canal", () => {
    it("pasar de tienda a ambos se permite aunque esté en un paquete activo", async () => {
      const { product, variantId } = await seedProduct(ProductChannel.STORE);
      await Bundle.create({
        name: "Kit",
        slug: "kit-both",
        description: "d",
        price: 89900,
        items: [{ productId: product._id, variantId, quantity: 1 }],
        status: BundleStatus.ACTIVE,
      });

      const updated = await updateProduct(product._id.toString(), { channel: ProductChannel.BOTH });
      expect(updated.channel).toBe(ProductChannel.BOTH);
    });

    it("pasar de ambos a solo suscripción se rechaza si está en un paquete activo", async () => {
      const { product, variantId } = await seedProduct(ProductChannel.BOTH);
      await Bundle.create({
        name: "Kit 2",
        slug: "kit-both-2",
        description: "d",
        price: 89900,
        items: [{ productId: product._id, variantId, quantity: 1 }],
        status: BundleStatus.ACTIVE,
      });

      await expect(
        updateProduct(product._id.toString(), { channel: ProductChannel.SUBSCRIPTION }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("pasar de ambos a solo tienda se rechaza si una edición PUBLICADA lo usa", async () => {
      const { product, variantId } = await seedProduct(ProductChannel.BOTH);
      const plan = await seedPlan();
      await SubscriptionEdition.create({
        planId: plan._id,
        cycleYear: 2026,
        cycleMonth: 9,
        title: "Sept",
        items: [{ productId: product._id, variantId, quantity: 1 }],
        status: EditionStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      await expect(
        updateProduct(product._id.toString(), { channel: ProductChannel.STORE }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("pasar de solo suscripción a ambos se permite aunque una edición publicada lo use", async () => {
      const { product, variantId } = await seedProduct(ProductChannel.SUBSCRIPTION);
      const plan = await seedPlan();
      await SubscriptionEdition.create({
        planId: plan._id,
        cycleYear: 2026,
        cycleMonth: 9,
        title: "Sept",
        items: [{ productId: product._id, variantId, quantity: 1 }],
        status: EditionStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      const updated = await updateProduct(product._id.toString(), { channel: ProductChannel.BOTH });
      expect(updated.channel).toBe(ProductChannel.BOTH);
    });
  });
});
