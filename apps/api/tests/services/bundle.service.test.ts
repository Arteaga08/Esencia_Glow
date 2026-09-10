import mongoose from "mongoose";
import { BundleStatus, ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import {
  archiveBundle,
  createBundle,
  getBundleById,
  listBundles,
  updateBundle,
} from "../../src/services/bundle.service.js";

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

describe("services/bundle — CRUD", () => {
  describe("createBundle", () => {
    it("crea el bundle en draft y calcula stockCache desde los componentes", async () => {
      const a = await seedVariant(10);
      const b = await seedVariant(4);

      const bundle = await createBundle({
        name: "Rutina de Noche",
        description: "Set de tres pasos",
        price: 59900,
        items: [
          { productId: a.productId, variantId: a.variantId, quantity: 1 },
          { productId: b.productId, variantId: b.variantId, quantity: 2 },
        ],
      });

      expect(bundle.slug).toBe("rutina-de-noche");
      expect(bundle.status).toBe(BundleStatus.DRAFT);
      expect(bundle.stockCache).toBe(2); // floor(4/2)=2 domina
    });

    it("un productId inexistente responde 400 y no crea el bundle", async () => {
      const a = await seedVariant(10);
      const fakeProductId = new mongoose.Types.ObjectId().toString();

      await expect(
        createBundle({
          name: "Bundle Roto",
          description: "desc",
          price: 1000,
          items: [{ productId: fakeProductId, variantId: a.variantId, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("un variantId que no pertenece al productId indicado responde 400", async () => {
      const a = await seedVariant(10);
      const b = await seedVariant(10);

      await expect(
        createBundle({
          name: "Bundle Cruzado",
          description: "desc",
          price: 1000,
          items: [{ productId: a.productId, variantId: b.variantId, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("updateBundle", () => {
    it("reemplaza items completos y recalcula stockCache", async () => {
      const a = await seedVariant(10);
      const b = await seedVariant(2);

      const bundle = await createBundle({
        name: "Set Inicial",
        description: "desc",
        price: 1000,
        items: [{ productId: a.productId, variantId: a.variantId, quantity: 1 }],
      });
      expect(bundle.stockCache).toBe(10);

      const updated = await updateBundle(bundle._id.toString(), {
        items: [{ productId: b.productId, variantId: b.variantId, quantity: 1 }],
      });

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0]?.variantId.toString()).toBe(b.variantId);
      expect(updated.stockCache).toBe(2);
    });

    it("cambiar solo el precio no toca items ni stockCache", async () => {
      const a = await seedVariant(10);
      const bundle = await createBundle({
        name: "Set Precio",
        description: "desc",
        price: 1000,
        items: [{ productId: a.productId, variantId: a.variantId, quantity: 1 }],
      });

      const updated = await updateBundle(bundle._id.toString(), { price: 2000 });

      expect(updated.price).toBe(2000);
      expect(updated.items).toHaveLength(1);
      expect(updated.stockCache).toBe(10);
    });

    it("cambiar el status a active lo hace elegible para el catálogo público", async () => {
      const a = await seedVariant(10);
      const bundle = await createBundle({
        name: "Set Publicable",
        description: "desc",
        price: 1000,
        items: [{ productId: a.productId, variantId: a.variantId, quantity: 1 }],
      });

      const updated = await updateBundle(bundle._id.toString(), { status: BundleStatus.ACTIVE });
      expect(updated.status).toBe(BundleStatus.ACTIVE);
    });
  });

  describe("archiveBundle", () => {
    it("archiva en vez de borrar (soft delete)", async () => {
      const a = await seedVariant(10);
      const bundle = await createBundle({
        name: "Set Para Archivar",
        description: "desc",
        price: 1000,
        items: [{ productId: a.productId, variantId: a.variantId, quantity: 1 }],
      });

      await archiveBundle(bundle._id.toString());

      const reloaded = await getBundleById(bundle._id.toString());
      expect(reloaded.status).toBe(BundleStatus.ARCHIVED);
    });
  });

  describe("listBundles", () => {
    it("filtra por status y busca por nombre", async () => {
      const a = await seedVariant(10);
      const draft = await createBundle({
        name: "Rutina Matutina",
        description: "desc",
        price: 1000,
        items: [{ productId: a.productId, variantId: a.variantId, quantity: 1 }],
      });
      await createBundle({
        name: "Rutina Nocturna",
        description: "desc",
        price: 1500,
        items: [{ productId: a.productId, variantId: a.variantId, quantity: 1 }],
      });
      await updateBundle(draft._id.toString(), { status: BundleStatus.ACTIVE });

      const active = await listBundles({
        page: 1,
        limit: 20,
        sort: { field: "createdAt", direction: "asc" },
        search: undefined,
        status: BundleStatus.ACTIVE,
      });
      expect(active.meta.total).toBe(1);
      expect(active.bundles[0]?.name).toBe("Rutina Matutina");

      const bySearch = await listBundles({
        page: 1,
        limit: 20,
        sort: { field: "createdAt", direction: "asc" },
        search: "nocturna",
      });
      expect(bySearch.meta.total).toBe(1);
      expect(bySearch.bundles[0]?.name).toBe("Rutina Nocturna");
    });
  });
});
