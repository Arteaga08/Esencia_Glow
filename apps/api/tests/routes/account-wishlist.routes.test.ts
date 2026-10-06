import { ProductStatus } from "@esencia-glow/shared";
import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();
let counter = 0;

async function seedProduct(opts: { status?: ProductStatus; onHand?: number } = {}) {
  counter += 1;
  const category = await Category.create({ name: `Cat WL${counter}`, slug: `cat-wl${counter}` });
  const product = await Product.create({
    name: `Producto WL${counter}`,
    slug: `producto-wl${counter}`,
    description: "d",
    categoryId: category._id,
    status: opts.status ?? ProductStatus.ACTIVE,
    variants: [
      {
        sku: `SKU-WL${counter}`,
        name: "30 ml",
        price: 54900,
        listPrice: 64900,
        weightGrams: 100,
        dimensionsCm: { length: 5, width: 5, height: 5 },
        isActive: true,
      },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand: opts.onHand ?? 5, reserved: 0 });
  return product;
}

async function storedWishlistLength(userId: string): Promise<number> {
  const { User } = await import("../../src/models/user.model.js");
  const user = await User.findById(userId).select("wishlist").lean<{ wishlist?: unknown[] }>();
  return user?.wishlist?.length ?? 0;
}

const add = (agent: ReturnType<typeof request.agent>, itemId: string) =>
  agent.post("/api/v1/account/wishlist").send({ itemType: "product", itemId });

describe("routes/account/wishlist — guardados", () => {
  it("401 sin sesión", async () => {
    expect((await request(app).get("/api/v1/account/wishlist")).status).toBe(401);
  });

  it("guarda, hidrata contra el catálogo vivo y cuenta en GET /account", async () => {
    const { agent } = await createCustomerSession(app);
    const product = await seedProduct();
    expect((await add(agent, product._id.toString())).status).toBe(201);

    const res = await agent.get("/api/v1/account/wishlist");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      itemType: "product",
      itemId: product._id.toString(),
      slug: product.slug,
      name: product.name,
      priceCents: 54900,
      listPriceCents: 64900,
      variantLabel: "30 ml",
      available: true,
    });
    expect((await agent.get("/api/v1/account")).body.data.wishlistCount).toBe(1);
  });

  it("es idempotente: guardar dos veces no duplica", async () => {
    const { agent } = await createCustomerSession(app);
    const product = await seedProduct();
    await add(agent, product._id.toString());
    const again = await add(agent, product._id.toString());

    expect(again.status).toBe(200);
    expect((await agent.get("/api/v1/account/wishlist")).body.data).toHaveLength(1);
  });

  it("quita un guardado; quitar uno que no está es 200", async () => {
    const { agent } = await createCustomerSession(app);
    const product = await seedProduct();
    await add(agent, product._id.toString());

    expect((await agent.delete(`/api/v1/account/wishlist/product/${product._id}`)).status).toBe(200);
    expect((await agent.delete(`/api/v1/account/wishlist/product/${product._id}`)).status).toBe(200);
    expect((await agent.get("/api/v1/account/wishlist")).body.data).toHaveLength(0);
  });

  it("marca no disponible un producto sin stock", async () => {
    const { agent } = await createCustomerSession(app);
    const product = await seedProduct({ onHand: 0 });
    await add(agent, product._id.toString());

    expect((await agent.get("/api/v1/account/wishlist")).body.data[0].available).toBe(false);
  });

  it("oculta un producto archivado de la lista y del conteo", async () => {
    const { agent } = await createCustomerSession(app);
    const product = await seedProduct();
    await add(agent, product._id.toString());
    await Product.updateOne({ _id: product._id }, { $set: { status: ProductStatus.ARCHIVED } });

    expect((await agent.get("/api/v1/account/wishlist")).body.data).toHaveLength(0);
    expect((await agent.get("/api/v1/account")).body.data.wishlistCount).toBe(0);
  });

  it("el guardado sobrevive a un borrador y reaparece al reactivar el producto", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const product = await seedProduct();
    await add(agent, product._id.toString());

    await Product.updateOne({ _id: product._id }, { $set: { status: ProductStatus.DRAFT } });
    expect((await agent.get("/api/v1/account/wishlist")).body.data).toHaveLength(0);
    expect((await agent.get("/api/v1/account")).body.data.wishlistCount).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await storedWishlistLength(userId)).toBe(1);

    await Product.updateOne({ _id: product._id }, { $set: { status: ProductStatus.ACTIVE } });
    expect((await agent.get("/api/v1/account/wishlist")).body.data).toHaveLength(1);
    expect((await agent.get("/api/v1/account")).body.data.wishlistCount).toBe(1);
  });

  it("solo poda el guardado cuando el producto ya no existe en la colección", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const product = await seedProduct();
    await add(agent, product._id.toString());
    await Product.deleteOne({ _id: product._id });

    expect((await agent.get("/api/v1/account/wishlist")).body.data).toHaveLength(0);
    await vi.waitFor(async () => expect(await storedWishlistLength(userId)).toBe(0));
  });

  it("404 al guardar un producto activo sin variantes activas", async () => {
    const { agent } = await createCustomerSession(app);
    const product = await seedProduct();
    await Product.updateOne({ _id: product._id }, { $set: { "variants.0.isActive": false } });

    expect((await add(agent, product._id.toString())).status).toBe(404);
  });

  it("dos guardados simultáneos del mismo producto dejan una sola entrada", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const product = await seedProduct();
    const results = await Promise.all([add(agent, product._id.toString()), add(agent, product._id.toString()), add(agent, product._id.toString())]);

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await storedWishlistLength(userId)).toBe(1);
  });

  it("GET ?itemId= responde saved sin hidratar el catálogo", async () => {
    const { agent } = await createCustomerSession(app);
    const saved = await seedProduct();
    const other = await seedProduct();
    await add(agent, saved._id.toString());

    const yes = await agent.get(`/api/v1/account/wishlist?itemId=${saved._id}`);
    expect(yes.status).toBe(200);
    expect(yes.body.data).toEqual({ saved: true });
    expect((await agent.get(`/api/v1/account/wishlist?itemId=${other._id}`)).body.data).toEqual({ saved: false });
  });

  it("GET ?itemId= responde saved aunque el producto esté oculto (no toca el catálogo)", async () => {
    const { agent } = await createCustomerSession(app);
    const product = await seedProduct();
    await add(agent, product._id.toString());
    await Product.updateOne({ _id: product._id }, { $set: { status: ProductStatus.DRAFT } });

    expect((await agent.get(`/api/v1/account/wishlist?itemId=${product._id}`)).body.data).toEqual({ saved: true });
  });

  it("400 con un itemId mal formado", async () => {
    const { agent } = await createCustomerSession(app);
    expect((await agent.get("/api/v1/account/wishlist?itemId=nope")).status).toBe(400);
  });

  it("404 al guardar un producto inexistente, archivado o en borrador", async () => {
    const { agent } = await createCustomerSession(app);
    const draft = await seedProduct({ status: ProductStatus.DRAFT });

    expect((await add(agent, "64b000000000000000000000")).status).toBe(404);
    expect((await add(agent, draft._id.toString())).status).toBe(404);
  });

  it("400 con itemType distinto de product o id mal formado", async () => {
    const { agent } = await createCustomerSession(app);
    expect((await agent.post("/api/v1/account/wishlist").send({ itemType: "bundle", itemId: "64b000000000000000000000" })).status).toBe(400);
    expect((await add(agent, "nope")).status).toBe(400);
  });

  it("cada clienta ve solo lo suyo", async () => {
    const a = await createCustomerSession(app);
    const b = await createCustomerSession(app);
    const product = await seedProduct();
    await add(a.agent, product._id.toString());

    expect((await b.agent.get("/api/v1/account/wishlist")).body.data).toHaveLength(0);
  });

  it("topa en 50 con 409", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const { User } = await import("../../src/models/user.model.js");
    const filler = Array.from({ length: 50 }, () => ({ itemType: "product", itemId: new Types.ObjectId(), addedAt: new Date() }));
    await User.updateOne({ _id: userId }, { $set: { wishlist: filler } });
    const product = await seedProduct();

    expect((await add(agent, product._id.toString())).status).toBe(409);
  });
});
