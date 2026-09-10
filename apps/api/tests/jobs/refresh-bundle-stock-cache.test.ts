import mongoose from "mongoose";
import { BundleStatus, ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { Bundle } from "../../src/models/bundle.model.js";
import { createBundle, updateBundle } from "../../src/services/bundle.service.js";
import { refreshBundleStockCaches } from "../../src/jobs/refresh-bundle-stock-cache.js";

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
  return { productId: product._id.toString(), variantId, sku };
}

describe("jobs/refreshBundleStockCaches", () => {
  it("recalcula stockCache cuando el inventario cambió por fuera del bundle", async () => {
    const a = await seedVariant(10);
    const bundle = await createBundle({
      name: "Bundle Drift",
      description: "desc",
      price: 1000,
      items: [{ productId: a.productId, variantId: a.variantId.toString(), quantity: 1 }],
    });
    expect(bundle.stockCache).toBe(10);

    // Un ajuste manual de inventario (fuera del flujo de bundle) no fan-out
    // al bundle — el cron es quien lo pone al día.
    await Inventory.updateOne({ variantId: a.variantId }, { $set: { onHand: 3 } });

    const summary = await refreshBundleStockCaches();

    expect(summary.updated).toBe(1);
    const reloaded = await Bundle.findById(bundle._id).lean();
    expect(reloaded?.stockCache).toBe(3);
  });

  it("no cuenta como actualizado un bundle cuyo stockCache ya está al día", async () => {
    const a = await seedVariant(10);
    await createBundle({
      name: "Bundle Sin Drift",
      description: "desc",
      price: 1000,
      items: [{ productId: a.productId, variantId: a.variantId.toString(), quantity: 1 }],
    });

    const summary = await refreshBundleStockCaches();
    expect(summary.updated).toBe(0);
  });

  it("no refresca bundles archivados", async () => {
    const a = await seedVariant(10);
    const bundle = await createBundle({
      name: "Bundle Archivado",
      description: "desc",
      price: 1000,
      items: [{ productId: a.productId, variantId: a.variantId.toString(), quantity: 1 }],
    });
    await updateBundle(bundle._id.toString(), { status: BundleStatus.ARCHIVED });
    await Inventory.updateOne({ variantId: a.variantId }, { $set: { onHand: 0 } });

    const summary = await refreshBundleStockCaches();

    expect(summary.scanned).toBe(0);
    const reloaded = await Bundle.findById(bundle._id).lean();
    expect(reloaded?.stockCache).toBe(10); // no tocado
  });
});
