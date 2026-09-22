import mongoose from "mongoose";
import { EditionStatus, ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it, vi } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { SubscriptionEdition } from "../../src/models/subscription-edition.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import {
  createEdition,
  deleteEdition,
  getEditionById,
  updateEdition,
} from "../../src/services/subscription-edition.service.js";
import { publishEdition, unpublishEdition } from "../../src/services/subscription-edition-publish.service.js";

let seedCounter = 0;

async function seedPlan() {
  seedCounter += 1;
  return SubscriptionPlan.create({
    name: `Plan ${seedCounter}`,
    slug: `plan-${seedCounter}`,
    description: "d",
    priceCents: 49900,
    maxActiveSeats: 100,
  });
}

async function seedProduct(opts: { channel?: ProductChannel; status?: ProductStatus; isActive?: boolean } = {}) {
  seedCounter += 1;
  const category = await Category.create({ name: `Cat E${seedCounter}`, slug: `cat-e${seedCounter}` });
  const product = await Product.create({
    name: `Producto E${seedCounter}`,
    slug: `producto-e${seedCounter}`,
    description: "d",
    categoryId: category._id,
    status: opts.status ?? ProductStatus.ACTIVE,
    channel: opts.channel ?? ProductChannel.SUBSCRIPTION,
    variants: [
      {
        sku: `SKU-E${seedCounter}`,
        name: "Variante",
        price: 10000,
        weightGrams: 100,
        dimensionsCm: { length: 5, width: 5, height: 5 },
        isActive: opts.isActive ?? true,
      },
    ],
  });
  return { product, variantId: product.variants[0]!._id };
}

describe("services/subscription-edition — CRUD y publicación", () => {
  it("crea una edición vacía en DRAFT", async () => {
    const plan = await seedPlan();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    expect(edition.status).toBe(EditionStatus.DRAFT);
    expect(edition.items).toHaveLength(0);
  });

  it("segunda edición del mismo plan y ciclo responde 409 (traducido desde E11000)", async () => {
    const plan = await seedPlan();
    await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await expect(
      createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept 2" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("PATCH de items con una variante que no pertenece al producto responde 400", async () => {
    const plan = await seedPlan();
    const { product } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });

    await expect(
      updateEdition(edition._id.toString(), {
        items: [{ productId: product._id.toString(), variantId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("PATCH de items válidos actualiza la edición", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });

    const updated = await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    expect(updated.items).toHaveLength(1);
  });

  it("publicar sin items responde 400", async () => {
    const plan = await seedPlan();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await expect(publishEdition(edition._id.toString(), plan._id.toString())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("publicar con un producto de canal tienda responde 400", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct({ channel: ProductChannel.STORE });
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    await expect(publishEdition(edition._id.toString(), plan._id.toString())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("publicar con un producto archivado responde 400", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct({ status: ProductStatus.ARCHIVED });
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    await expect(publishEdition(edition._id.toString(), plan._id.toString())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("publicar con una variante inactiva responde 400", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct({ isActive: false });
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    await expect(publishEdition(edition._id.toString(), plan._id.toString())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("publica correctamente con items válidos", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    const published = await publishEdition(edition._id.toString(), plan._id.toString());
    expect(published.status).toBe(EditionStatus.PUBLISHED);
    expect(published.publishedAt).toBeDefined();
  });

  it("publicar dos veces responde 409 sin pisar publishedAt", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const first = await publishEdition(edition._id.toString(), plan._id.toString());

    await expect(publishEdition(edition._id.toString(), plan._id.toString())).rejects.toMatchObject({
      statusCode: 409,
    });
    const reread = await getEditionById(edition._id.toString());
    expect(reread.publishedAt).toBe(first.publishedAt?.toISOString());
  });

  it("PATCH de items sobre una edición PUBLISHED responde 409, pero PATCH de title responde 200", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    await publishEdition(edition._id.toString(), plan._id.toString());

    await expect(
      updateEdition(edition._id.toString(), {
        items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const titleUpdate = await updateEdition(edition._id.toString(), { title: "Septiembre editado" });
    expect(titleUpdate.title).toBe("Septiembre editado");
  });

  it("unpublishEdition regresa a DRAFT una edición publicada sin firstBilledAt", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    await publishEdition(edition._id.toString(), plan._id.toString());

    const unpublished = await unpublishEdition(edition._id.toString());
    expect(unpublished.status).toBe(EditionStatus.DRAFT);
  });

  it("unpublishEdition con firstBilledAt sellado responde 409", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    await publishEdition(edition._id.toString(), plan._id.toString());
    await SubscriptionEdition.updateOne({ _id: edition._id }, { $set: { firstBilledAt: new Date() } });

    await expect(unpublishEdition(edition._id.toString())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("deleteEdition borra una edición DRAFT", async () => {
    const plan = await seedPlan();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await deleteEdition(edition._id.toString());
    await expect(getEditionById(edition._id.toString())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("🔀 publishEdition concurrente entre la lectura y el save() de updateEdition: no debe pisar items ya publicados", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    const originalFindById = SubscriptionEdition.findById.bind(SubscriptionEdition);
    const spy = vi.spyOn(SubscriptionEdition, "findById").mockImplementationOnce(((id: string) => {
      const snapshot = originalFindById(id);
      // Publica ANTES de que la lectura de updateEdition resuelva en memoria
      // (la query ya viajó al server con el estado viejo), simulando que la
      // publicación concurrente aterriza justo en la ventana entre la
      // lectura y la escritura de updateEdition.
      return snapshot.then(async (doc) => {
        await publishEdition(edition._id.toString(), plan._id.toString());
        return doc;
      });
    }) as typeof SubscriptionEdition.findById);

    await expect(
      updateEdition(edition._id.toString(), {
        items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 99 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    spy.mockRestore();

    const reloaded = await getEditionById(edition._id.toString());
    expect(reloaded.status).toBe(EditionStatus.PUBLISHED);
    expect(reloaded.items[0]!.quantity).toBe(1);
  });

  it("🔀 publishEdition concurrente entre la lectura y el deleteOne() de deleteEdition: no debe borrar una edición ya publicada", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    const originalFindById = SubscriptionEdition.findById.bind(SubscriptionEdition);
    const spy = vi.spyOn(SubscriptionEdition, "findById").mockImplementationOnce(((id: string) => {
      const snapshot = originalFindById(id);
      return snapshot.then(async (doc) => {
        await publishEdition(edition._id.toString(), plan._id.toString());
        return doc;
      });
    }) as typeof SubscriptionEdition.findById);

    await expect(deleteEdition(edition._id.toString())).rejects.toMatchObject({ statusCode: 409 });
    spy.mockRestore();

    const reloaded = await getEditionById(edition._id.toString());
    expect(reloaded.status).toBe(EditionStatus.PUBLISHED);
  });

  it("deleteEdition sobre una edición PUBLISHED responde 409", async () => {
    const plan = await seedPlan();
    const { product, variantId } = await seedProduct();
    const edition = await createEdition({ planId: plan._id.toString(), cycleYear: 2026, cycleMonth: 9, title: "Sept" });
    await updateEdition(edition._id.toString(), {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    await publishEdition(edition._id.toString(), plan._id.toString());

    await expect(deleteEdition(edition._id.toString())).rejects.toMatchObject({ statusCode: 409 });
  });
});
