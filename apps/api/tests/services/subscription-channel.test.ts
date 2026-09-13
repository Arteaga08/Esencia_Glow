import { BundleStatus, EditionStatus, ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Bundle } from "../../src/models/bundle.model.js";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { SubscriptionEdition } from "../../src/models/subscription-edition.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { resolveCartLines } from "../../src/services/cart-resolution.service.js";
import { assertItemsValid } from "../../src/services/bundle.service.js";
import { assertVariantsAvailable } from "../../src/services/stock-reservation.service.js";
import { updateProduct } from "../../src/services/product.service.js";
import { withTransaction } from "../../src/utils/with-transaction.js";

/**
 * Blindaje del canal de suscripción (Milestone 1.7.1, §B del plan): un
 * producto `channel: SUBSCRIPTION` reutiliza catálogo/inventario tal cual,
 * pero no se puede comprar suelto ni curar dentro de un bundle. Ver
 * cart-resolution.service.ts y bundle.service.ts.
 */

let seedCounter = 0;

async function seedProduct(opts: { channel?: ProductChannel; isActive?: boolean; status?: ProductStatus } = {}) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat SC${suffix}`, slug: `cat-sc${suffix}` });
  const product = await Product.create({
    name: `Producto SC${suffix}`,
    slug: `producto-sc${suffix}`,
    description: "Descripción de prueba",
    categoryId: category._id,
    status: opts.status ?? ProductStatus.ACTIVE,
    channel: opts.channel ?? ProductChannel.STORE,
    variants: [
      {
        sku: `SKU-SC${suffix}`,
        name: `Variante SC${suffix}`,
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: opts.isActive ?? true,
      },
    ],
  });
  return { product, variantId: product.variants[0]!._id };
}

describe("services/subscription-channel — canal de suscripción en el catálogo", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  it("resolveCartLines rechaza una línea de producto de canal suscripción", async () => {
    const { variantId } = await seedProduct({ channel: ProductChannel.SUBSCRIPTION });

    await expect(
      resolveCartLines([{ itemType: "product", itemId: variantId.toString(), quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("resolveCartLines resuelve sin problema una línea de producto de canal tienda", async () => {
    const { variantId } = await seedProduct({ channel: ProductChannel.STORE });

    const [line] = await resolveCartLines([{ itemType: "product", itemId: variantId.toString(), quantity: 1 }]);
    expect(line!.itemType).toBe("product");
  });

  it("resolveCartLines rechaza un bundle cuyo componente es de canal suscripción", async () => {
    const { product, variantId } = await seedProduct({ channel: ProductChannel.SUBSCRIPTION });
    const bundle = await Bundle.create({
      name: "Kit con componente exclusivo",
      slug: `kit-exclusivo-${++seedCounter}`,
      description: "d",
      price: 89900,
      items: [{ productId: product._id, variantId, quantity: 1 }],
      status: BundleStatus.ACTIVE,
    });

    await expect(
      resolveCartLines([{ itemType: "bundle", itemId: bundle._id.toString(), quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("assertItemsValid rechaza al curar un bundle con un componente de canal suscripción", async () => {
    const { product, variantId } = await seedProduct({ channel: ProductChannel.SUBSCRIPTION });

    await expect(
      assertItemsValid([{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("assertItemsValid acepta un componente de canal tienda", async () => {
    const { product, variantId } = await seedProduct({ channel: ProductChannel.STORE });

    await expect(
      assertItemsValid([{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }]),
    ).resolves.toBeUndefined();
  });

  it("un producto nuevo de canal suscripción no aparece en el catálogo público", async () => {
    await seedProduct({ channel: ProductChannel.SUBSCRIPTION });
    const { buildProductFilter } = await import("../../src/utils/build-product-filter.js");

    const filter = buildProductFilter({ publicOnly: true });
    const visible = await Product.find(filter).lean();
    expect(visible).toHaveLength(0);
  });

  it("un producto legado sin el campo channel (datos previos a 1.7.1) sigue visible en el catálogo público", async () => {
    seedCounter += 1;
    const category = await Category.create({ name: `Cat Legacy${seedCounter}`, slug: `cat-legacy${seedCounter}` });
    // Inserción cruda, sin pasar por Mongoose: simula un documento creado
    // ANTES de que este milestone agregara el campo `channel` al schema.
    await Product.collection.insertOne({
      name: "Producto Legado",
      slug: `producto-legado-${seedCounter}`,
      description: "d",
      categoryId: category._id,
      status: ProductStatus.ACTIVE,
      images: [],
      variants: [
        {
          sku: `SKU-LEGACY${seedCounter}`,
          name: "Variante",
          attributes: {},
          price: 10000,
          weightGrams: 100,
          dimensionsCm: { length: 5, width: 5, height: 5 },
          isActive: true,
        },
      ],
      minPrice: 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { buildProductFilter } = await import("../../src/utils/build-product-filter.js");

    const filter = buildProductFilter({ publicOnly: true });
    const visible = await Product.find(filter).lean();
    expect(visible.map((p) => p.slug)).toContain(`producto-legado-${seedCounter}`);
  });

  it("assertVariantsAvailable sigue permitiendo reservar una variante de canal suscripción (la reserva de 1.7.2 la usa)", async () => {
    const { variantId } = await seedProduct({ channel: ProductChannel.SUBSCRIPTION });

    await expect(
      withTransaction((session) => assertVariantsAvailable([variantId.toString()], session)),
    ).resolves.toBeUndefined();
  });

  it("cambiar un producto de suscripción a tienda se rechaza si una edición PUBLICADA lo usa", async () => {
    const { product, variantId } = await seedProduct({ channel: ProductChannel.SUBSCRIPTION });
    seedCounter += 1;
    const plan = await SubscriptionPlan.create({
      name: `Plan Canal ${seedCounter}`,
      slug: `plan-canal-${seedCounter}`,
      description: "d",
      priceCents: 49900,
      maxActiveSeats: 10,
    });
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

  it("cambiar un producto de suscripción a tienda se permite si solo lo usa una edición en DRAFT", async () => {
    const { product, variantId } = await seedProduct({ channel: ProductChannel.SUBSCRIPTION });
    seedCounter += 1;
    const plan = await SubscriptionPlan.create({
      name: `Plan Canal Draft ${seedCounter}`,
      slug: `plan-canal-draft-${seedCounter}`,
      description: "d",
      priceCents: 49900,
      maxActiveSeats: 10,
    });
    await SubscriptionEdition.create({
      planId: plan._id,
      cycleYear: 2026,
      cycleMonth: 10,
      title: "Oct",
      items: [{ productId: product._id, variantId, quantity: 1 }],
      status: EditionStatus.DRAFT,
    });

    const updated = await updateProduct(product._id.toString(), { channel: ProductChannel.STORE });
    expect(updated.channel).toBe(ProductChannel.STORE);
  });
});
