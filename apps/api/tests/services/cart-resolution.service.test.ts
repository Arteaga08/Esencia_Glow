import mongoose from "mongoose";
import { BundleStatus, ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Bundle } from "../../src/models/bundle.model.js";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { resolveCartLines } from "../../src/services/cart-resolution.service.js";

let seedCounter = 0;

async function seedProduct(
  opts: {
    price?: number;
    weightGrams?: number;
    isActive?: boolean;
    status?: ProductStatus;
  } = {},
) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat R${suffix}`, slug: `cat-r${suffix}` });
  const product = await Product.create({
    name: `Producto R${suffix}`,
    slug: `producto-r${suffix}`,
    description: "Descripción de prueba",
    categoryId: category._id,
    status: opts.status ?? ProductStatus.ACTIVE,
    variants: [
      {
        sku: `SKU-R${suffix}`,
        name: `Variante R${suffix}`,
        price: opts.price ?? 50000,
        weightGrams: opts.weightGrams ?? 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: opts.isActive ?? true,
      },
    ],
  });
  const variant = product.variants[0]!;
  return { product, variantId: variant._id, sku: variant.sku, price: variant.price };
}

async function seedBundle(componentPrice = 50000, status: BundleStatus = BundleStatus.ACTIVE) {
  const { product, variantId } = await seedProduct({ price: componentPrice });
  const bundle = await Bundle.create({
    name: "Kit Glow",
    slug: `kit-glow-${++seedCounter}`,
    description: "Kit de prueba",
    price: 89900,
    items: [{ productId: product._id, variantId, quantity: 2 }],
    status,
  });
  return { bundle, product, variantId };
}

describe("services/cart-resolution", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  it("rechaza un carrito vacío", async () => {
    await expect(resolveCartLines([])).rejects.toMatchObject({ statusCode: 400 });
  });

  it("resuelve una línea de producto con snapshot completo desde la DB", async () => {
    const { variantId, sku, price } = await seedProduct({ price: 75000, weightGrams: 300 });

    const [line] = await resolveCartLines([{ itemType: "product", itemId: variantId.toString(), quantity: 2 }]);

    expect(line!.itemType).toBe("product");
    expect(line!.sku).toBe(sku);
    expect(line!.unitPriceCents).toBe(price);
    expect(line!.lineTotalCents).toBe(price * 2);
    expect(line!.parcelItems).toEqual([
      { weightGrams: 300, dimensionsCm: { length: 10, width: 10, height: 10 }, quantity: 2 },
    ]);
    expect(line!.reservationLines).toEqual([{ variantId: variantId.toString(), quantity: 2 }]);
  });

  it("rechaza una variante inactiva", async () => {
    const { variantId } = await seedProduct({ isActive: false });
    await expect(
      resolveCartLines([{ itemType: "product", itemId: variantId.toString(), quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rechaza un producto archivado", async () => {
    const { variantId } = await seedProduct({ status: ProductStatus.ARCHIVED });
    await expect(
      resolveCartLines([{ itemType: "product", itemId: variantId.toString(), quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rechaza una variante que no existe", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      resolveCartLines([{ itemType: "product", itemId: fakeId, quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("resuelve una línea de bundle: cobra el precio del bundle, NO la suma de componentes", async () => {
    const { bundle, variantId } = await seedBundle(50000);

    const [line] = await resolveCartLines([{ itemType: "bundle", itemId: bundle._id.toString(), quantity: 1 }]);

    expect(line!.itemType).toBe("bundle");
    expect(line!.unitPriceCents).toBe(89900);
    expect(line!.lineTotalCents).toBe(89900);
    expect(line!.components).toHaveLength(1);
    expect(line!.components![0]!.catalogUnitPriceCents).toBe(50000);
    expect(line!.components![0]!.quantity).toBe(2); // 2 por bundle, comprando 1 bundle
    expect(line!.reservationLines).toEqual([{ variantId: variantId.toString(), quantity: 2 }]);
    expect(line!.sourceBundle).toEqual({ bundleId: bundle._id.toString(), quantity: 1 });
  });

  it("multiplica los componentes del bundle por la cantidad de paquetes comprados", async () => {
    const { bundle, variantId } = await seedBundle(50000);

    const [line] = await resolveCartLines([{ itemType: "bundle", itemId: bundle._id.toString(), quantity: 3 }]);

    expect(line!.lineTotalCents).toBe(89900 * 3);
    expect(line!.components![0]!.quantity).toBe(6); // 2 * 3
    expect(line!.reservationLines).toEqual([{ variantId: variantId.toString(), quantity: 6 }]);
    expect(line!.parcelItems).toEqual([
      { weightGrams: 200, dimensionsCm: { length: 10, width: 10, height: 10 }, quantity: 6 },
    ]);
  });

  it("rechaza un paquete que no está activo", async () => {
    const { bundle } = await seedBundle(50000, BundleStatus.DRAFT);
    await expect(
      resolveCartLines([{ itemType: "bundle", itemId: bundle._id.toString(), quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rechaza un paquete cuyo componente ya no está a la venta", async () => {
    const { product, variantId } = await seedProduct({ isActive: true });
    const bundle = await Bundle.create({
      name: "Kit Roto",
      slug: "kit-roto",
      description: "d",
      price: 1000,
      items: [{ productId: product._id, variantId, quantity: 1 }],
      status: BundleStatus.ACTIVE,
    });
    await Product.updateOne({ _id: product._id }, { $set: { "variants.0.isActive": false } });

    await expect(
      resolveCartLines([{ itemType: "bundle", itemId: bundle._id.toString(), quantity: 1 }]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("un carrito mixto (producto + bundle) fusiona reservationLines por variante", async () => {
    const { product: sharedProduct, variantId: sharedVariantId } = await seedProduct({ price: 30000 });
    const bundle = await Bundle.create({
      name: "Kit Compartido",
      slug: "kit-compartido",
      description: "d",
      price: 60000,
      items: [{ productId: sharedProduct._id, variantId: sharedVariantId, quantity: 1 }],
      status: BundleStatus.ACTIVE,
    });

    const lines = await resolveCartLines([
      { itemType: "product", itemId: sharedVariantId.toString(), quantity: 1 },
      { itemType: "bundle", itemId: bundle._id.toString(), quantity: 2 },
    ]);

    expect(lines).toHaveLength(2);
    const allReservationLines = lines.flatMap((l) => l.reservationLines);
    // 1 unidad directa + 2 (1*2 del bundle) de la misma variante = 3 en total repartidas en las 2 líneas
    const total = allReservationLines
      .filter((r) => r.variantId === sharedVariantId.toString())
      .reduce((sum, r) => sum + r.quantity, 0);
    expect(total).toBe(3);
  });

  it("respeta el tope de MAX_BUNDLE_QUANTITY para líneas de bundle", async () => {
    const { bundle } = await seedBundle(1000);
    await expect(
      resolveCartLines([{ itemType: "bundle", itemId: bundle._id.toString(), quantity: 1000 }]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
