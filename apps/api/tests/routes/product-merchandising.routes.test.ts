import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { ensureBrand } from "../helpers/brand-fixtures.js";
import { createAdminSession } from "../helpers/admin-session.js";

const app = buildApp();

type Agent = ReturnType<typeof request.agent>;

async function createProduct(agent: Agent, categoryId: string, name: string, sku: string, extra: Record<string, unknown> = {}) {
  const { brand, ...rest } = extra;
  const created = await agent.post("/api/v1/admin/products").send({
    name,
    description: "Desc",
    categoryId,
    variants: [{ sku, name: "30 ml", price: 34900, weightGrams: 150 }],
    ...(typeof brand === "string" ? { brandId: await ensureBrand(agent, brand) } : {}),
    ...rest,
  });
  await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ status: "active" });
  return created;
}

describe("routes/products — marcas Más vendido y Novedad", () => {
  it("se crean apagadas por defecto y se editan por PATCH", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const created = await createProduct(agent, category.id, "Sérum A", "SER-A1");
    expect(created.body.data.isBestseller).toBe(false);
    expect(created.body.data.isNewArrival).toBe(false);

    const updated = await agent
      .patch(`/api/v1/admin/products/${created.body.data.id}`)
      .send({ isBestseller: true, isNewArrival: true });

    expect(updated.status).toBe(200);
    expect(updated.body.data.isBestseller).toBe(true);
    expect(updated.body.data.isNewArrival).toBe(true);
  });

  it("rechaza valores que no son booleanos", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const created = await createProduct(agent, category.id, "Sérum A", "SER-A1");

    const response = await agent
      .patch(`/api/v1/admin/products/${created.body.data.id}`)
      .send({ isBestseller: "quizás" });

    expect(response.status).toBe(400);
  });

  it("el catálogo público filtra por ?bestseller=true y ?newArrival=true", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    await createProduct(agent, category.id, "Sérum A", "SER-A1", { isBestseller: true });
    await createProduct(agent, category.id, "Sérum B", "SER-B1", { isNewArrival: true });
    await createProduct(agent, category.id, "Sérum C", "SER-C1");

    const bestsellers = await request(app).get("/api/v1/products?bestseller=true");
    const newArrivals = await request(app).get("/api/v1/products?newArrival=true");
    const all = await request(app).get("/api/v1/products");

    expect(bestsellers.body.data.map((p: { name: string }) => p.name)).toEqual(["Sérum A"]);
    expect(newArrivals.body.data.map((p: { name: string }) => p.name)).toEqual(["Sérum B"]);
    expect(all.body.data).toHaveLength(3);
  });

  it("las facetas con ?bestseller=true solo cubren los más vendidos", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    await createProduct(agent, category.id, "Sérum A", "SER-A1", { isBestseller: true, brand: "Cosrx" });
    await createProduct(agent, category.id, "Sérum B", "SER-B1", { brand: "Isntree" });

    const bestsellers = await request(app).get("/api/v1/products/facets?bestseller=true");
    const all = await request(app).get("/api/v1/products/facets");

    expect(bestsellers.body.data.brands).toEqual(["Cosrx"]);
    expect(all.body.data.brands).toEqual(["Cosrx", "Isntree"]);
  });

  it("la marca se guarda, se edita y se expone en el catálogo público", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const created = await createProduct(agent, category.id, "Sérum A", "SER-A1", { brand: "Beauty of Joseon" });
    expect(created.body.data.brand).toBe("Beauty of Joseon");

    const updated = await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ brandId: await ensureBrand(agent, "Anua") });
    expect(updated.body.data.brand).toBe("Anua");

    const publicList = await request(app).get("/api/v1/products");
    expect(publicList.body.data[0].brand).toBe("Anua");
  });
});

describe("routes/products — Novedad sin tope", () => {
  it("permite marcar más de cuatro novedades (la selección del home vive en el editor del home)", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });

    for (const n of [1, 2, 3, 4, 5]) {
      const created = await createProduct(agent, category.id, `Novedad ${n}`, `NOV-${n}`, { isNewArrival: true });
      expect(created.status).toBe(201);
    }
  });
});

describe("routes/products — tope de 12 más vendidos", () => {
  async function seedBestsellers(agent: Agent, categoryId: string, count: number) {
    const ids: string[] = [];
    for (let n = 1; n <= count; n += 1) {
      const created = await createProduct(agent, categoryId, `Vendido ${n}`, `VEN-${n}`, { isBestseller: true });
      ids.push(created.body.data.id as string);
    }
    return ids;
  }

  it("el decimotercero marcado al crear responde 409 con el error pegado al campo", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    await seedBestsellers(agent, category.id, 12);

    const thirteenth = await agent.post("/api/v1/admin/products").send({
      name: "Vendido 13",
      description: "Desc",
      categoryId: category.id,
      isBestseller: true,
      variants: [{ sku: "VEN-13", name: "30 ml", price: 34900, weightGrams: 150 }],
    });

    expect(thirteenth.status).toBe(409);
    expect(thirteenth.body.errors.isBestseller).toContain("12");
  });

  it("marcar uno más por PATCH responde 409, pero re-guardar uno ya marcado no", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const [first] = await seedBestsellers(agent, category.id, 12);
    const extra = await createProduct(agent, category.id, "Sérum extra", "EXT-1");

    const blocked = await agent.patch(`/api/v1/admin/products/${extra.body.data.id}`).send({ isBestseller: true });
    const resaved = await agent.patch(`/api/v1/admin/products/${first}`).send({ isBestseller: true, shortDescription: "Nueva" });

    expect(blocked.status).toBe(409);
    expect(resaved.status).toBe(200);
  });

  it("quitar la marca o archivar un producto libera el lugar", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const [first, second] = await seedBestsellers(agent, category.id, 12);
    const extra = await createProduct(agent, category.id, "Sérum extra", "EXT-1");
    const markExtra = () => agent.patch(`/api/v1/admin/products/${extra.body.data.id}`).send({ isBestseller: true });

    await agent.patch(`/api/v1/admin/products/${first}`).send({ isBestseller: false });
    expect((await markExtra()).status).toBe(200);

    expect((await agent.patch(`/api/v1/admin/products/${second}`).send({ isBestseller: true })).status).toBe(200);
    await agent.delete(`/api/v1/admin/products/${second}`);
    const another = await createProduct(agent, category.id, "Sérum otro", "OTR-1");
    expect((await agent.patch(`/api/v1/admin/products/${another.body.data.id}`).send({ isBestseller: true })).status).toBe(200);
  });

  it("un producto solo de suscripción no ocupa lugar", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    await createProduct(agent, category.id, "Solo caja", "BOX-1", { isBestseller: true, channel: "subscription" });

    const ids = await seedBestsellers(agent, category.id, 12);

    expect(ids).toHaveLength(12);
  });
});

describe("routes/products — fijar un más vendido al inicio", () => {
  const names = (response: { body: { data: { name: string }[] } }) => response.body.data.map((p) => p.name);

  it("los fijados salen primero y el resto por más recientes", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const a = await createProduct(agent, category.id, "A", "SKU-A", { isBestseller: true });
    await createProduct(agent, category.id, "B", "SKU-B", { isBestseller: true });
    await createProduct(agent, category.id, "C", "SKU-C", { isBestseller: true });
    const d = await createProduct(agent, category.id, "D", "SKU-D", { isBestseller: true });

    expect(names(await request(app).get("/api/v1/products?bestseller=true&sort=-createdAt"))).toEqual(["D", "C", "B", "A"]);

    await agent.patch(`/api/v1/admin/products/${a.body.data.id}`).send({ isBestsellerPinned: true });
    expect(names(await request(app).get("/api/v1/products?bestseller=true&sort=-createdAt"))).toEqual(["A", "D", "C", "B"]);

    await agent.patch(`/api/v1/admin/products/${d.body.data.id}`).send({ isBestsellerPinned: true });
    expect(names(await request(app).get("/api/v1/products?bestseller=true&sort=-createdAt"))).toEqual(["D", "A", "C", "B"]);
  });

  it("con otro orden (precio) el fijado no se antepone", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const a = await createProduct(agent, category.id, "A", "SKU-A", {
      isBestseller: true,
      variants: [{ sku: "SKU-A", name: "30 ml", price: 90000, weightGrams: 150 }],
    });
    await createProduct(agent, category.id, "B", "SKU-B", { isBestseller: true });
    await agent.patch(`/api/v1/admin/products/${a.body.data.id}`).send({ isBestsellerPinned: true });

    const byPrice = await request(app).get("/api/v1/products?bestseller=true&sort=minPrice");

    expect(names(byPrice)).toEqual(["B", "A"]);
  });

  it("se expone como isBestsellerPinned y quitar Más vendido también lo desfija", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const created = await createProduct(agent, category.id, "A", "SKU-A", { isBestseller: true });
    expect(created.body.data.isBestsellerPinned).toBe(false);
    const url = `/api/v1/admin/products/${created.body.data.id}`;

    const pinned = await agent.patch(url).send({ isBestsellerPinned: true });
    expect(pinned.body.data.isBestsellerPinned).toBe(true);

    const unmarked = await agent.patch(url).send({ isBestseller: false });
    expect(unmarked.body.data.isBestsellerPinned).toBe(false);

    const remarked = await agent.patch(url).send({ isBestseller: true });
    expect(remarked.body.data.isBestsellerPinned).toBe(false);
  });

  it("fijar un producto que no es más vendido responde 400 con el error pegado al campo", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const created = await createProduct(agent, category.id, "A", "SKU-A");

    const response = await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ isBestsellerPinned: true });

    expect(response.status).toBe(400);
    expect(response.body.errors.isBestsellerPinned).toBeTruthy();
  });
});
