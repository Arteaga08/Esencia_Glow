import mongoose from "mongoose";
import { BundleStatus, ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Bundle } from "../../src/models/bundle.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { resolvePublicCart } from "../../src/services/cart-public.service.js";
import { resetCheckoutFixtureCounter, seedBundleWithStock, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

const photo = { url: "https://cdn.test/a.jpg", publicId: "a", width: 10, height: 10, format: "jpg", bytes: 1, alt: "Frasco" };

describe("services/cart-public", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("resuelve una variante con stock: datos vivos y available true", async () => {
    const { product, variantId, price } = await seedVariantWithStock({ price: 34900, onHand: 5 });
    await Product.updateOne({ _id: product._id }, { brand: "Glow Lab", images: [photo] });

    const [line] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);

    expect(line).toMatchObject({
      itemType: "product",
      itemId: variantId.toString(),
      available: true,
      slug: product.slug,
      name: product.name,
      brand: "Glow Lab",
      variantLabel: "Variante",
      priceCents: price,
      image: { url: photo.url, alt: "Frasco" },
    });
  });

  it("incluye listPriceCents solo cuando es mayor al precio", async () => {
    const { product, variantId } = await seedVariantWithStock({ price: 30000 });
    await Product.updateOne({ _id: product._id }, { $set: { "variants.0.listPrice": 40000 } });
    const [withList] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);
    expect(withList!.listPriceCents).toBe(40000);

    await Product.updateOne({ _id: product._id }, { $set: { "variants.0.listPrice": 30000 } });
    const [noList] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);
    expect(noList).not.toHaveProperty("listPriceCents");
  });

  it("una variante agotada vuelve completa pero available false", async () => {
    const { variantId, price } = await seedVariantWithStock({ onHand: 0 });
    const [line] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);
    expect(line).toMatchObject({ available: false, priceCents: price });
    expect(line!.name).toBeDefined();
  });

  it("el stock apartado cuenta: onHand - reserved <= 0 es agotado", async () => {
    const { variantId } = await seedVariantWithStock({ onHand: 3 });
    await Inventory.updateOne({ variantId }, { reserved: 3 });
    const [line] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);
    expect(line!.available).toBe(false);
  });

  it("una variante inactiva vuelve sin datos", async () => {
    const { product, variantId } = await seedVariantWithStock();
    await Product.updateOne({ _id: product._id }, { $set: { "variants.0.isActive": false } });
    const [line] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);
    expect(line).toEqual({ itemType: "product", itemId: variantId.toString(), available: false });
  });

  it("un producto archivado o en borrador vuelve sin datos", async () => {
    const { product, variantId } = await seedVariantWithStock();
    for (const status of [ProductStatus.ARCHIVED, ProductStatus.DRAFT]) {
      await Product.updateOne({ _id: product._id }, { status });
      const [line] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);
      expect(line).toEqual({ itemType: "product", itemId: variantId.toString(), available: false });
    }
  });

  it("un id que no existe vuelve sin datos, sin lanzar", async () => {
    const ghost = new mongoose.Types.ObjectId().toString();
    const lines = await resolvePublicCart([
      { itemType: "product", itemId: ghost },
      { itemType: "bundle", itemId: ghost },
    ]);
    expect(lines).toEqual([
      { itemType: "product", itemId: ghost, available: false },
      { itemType: "bundle", itemId: ghost, available: false },
    ]);
  });

  it("un producto de canal suscripción no se resuelve", async () => {
    const { product, variantId } = await seedVariantWithStock();
    await Product.updateOne({ _id: product._id }, { channel: ProductChannel.SUBSCRIPTION });
    const [line] = await resolvePublicCart([{ itemType: "product", itemId: variantId.toString() }]);
    expect(line).toEqual({ itemType: "product", itemId: variantId.toString(), available: false });
  });

  it("un kit activo con stock: precio del kit, 'N productos' y foto del componente", async () => {
    const { bundle, product } = await seedBundleWithStock(50000, 89900);
    await Product.updateOne({ _id: product._id }, { images: [photo] });
    const [line] = await resolvePublicCart([{ itemType: "bundle", itemId: bundle._id.toString() }]);
    expect(line).toMatchObject({
      itemType: "bundle",
      available: true,
      name: "Kit Glow",
      slug: bundle.slug,
      priceCents: 89900,
      variantLabel: "2 productos",
      image: { url: photo.url },
    });
  });

  it("un kit con foto propia usa esa foto", async () => {
    const { bundle } = await seedBundleWithStock();
    await Bundle.updateOne({ _id: bundle._id }, { images: [{ ...photo, url: "https://cdn.test/kit.jpg" }] });
    const [line] = await resolvePublicCart([{ itemType: "bundle", itemId: bundle._id.toString() }]);
    expect(line!.image?.url).toBe("https://cdn.test/kit.jpg");
  });

  it("un kit cuyo componente se agotó vuelve completo pero available false", async () => {
    const { bundle, variantId } = await seedBundleWithStock();
    await Inventory.updateOne({ variantId }, { onHand: 1 }); // el kit pide 2 por unidad
    const [line] = await resolvePublicCart([{ itemType: "bundle", itemId: bundle._id.toString() }]);
    expect(line).toMatchObject({ available: false, priceCents: 89900 });
  });

  it("un kit inactivo vuelve sin datos", async () => {
    const { bundle } = await seedBundleWithStock();
    await Bundle.updateOne({ _id: bundle._id }, { status: BundleStatus.DRAFT });
    const [line] = await resolvePublicCart([{ itemType: "bundle", itemId: bundle._id.toString() }]);
    expect(line).toEqual({ itemType: "bundle", itemId: bundle._id.toString(), available: false });
  });

  it("un kit con un componente fuera de venta vuelve sin datos", async () => {
    const { bundle, product } = await seedBundleWithStock();
    await Product.updateOne({ _id: product._id }, { status: ProductStatus.ARCHIVED });
    const [line] = await resolvePublicCart([{ itemType: "bundle", itemId: bundle._id.toString() }]);
    expect(line).toEqual({ itemType: "bundle", itemId: bundle._id.toString(), available: false });
  });

  it("un lote mixto: una línea mala no tumba las demás y se conserva el orden", async () => {
    const good = await seedVariantWithStock();
    const kit = await seedBundleWithStock();
    const ghost = new mongoose.Types.ObjectId().toString();
    const lines = await resolvePublicCart([
      { itemType: "product", itemId: ghost },
      { itemType: "bundle", itemId: kit.bundle._id.toString() },
      { itemType: "product", itemId: good.variantId.toString() },
    ]);
    expect(lines.map((line) => line.available)).toEqual([false, true, true]);
    expect(lines.map((line) => line.itemId)).toEqual([ghost, kit.bundle._id.toString(), good.variantId.toString()]);
  });

  it("una línea repetida responde una sola vez", async () => {
    const { variantId } = await seedVariantWithStock();
    const id = variantId.toString();
    const lines = await resolvePublicCart([
      { itemType: "product", itemId: id },
      { itemType: "product", itemId: id },
    ]);
    expect(lines).toHaveLength(1);
  });
});
