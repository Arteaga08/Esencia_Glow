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

describe("routes/products — tope de 4 novedades", () => {
  async function seedFourNewArrivals(agent: Agent, categoryId: string) {
    const ids: string[] = [];
    for (const n of [1, 2, 3, 4]) {
      const created = await createProduct(agent, categoryId, `Novedad ${n}`, `NOV-${n}`, { isNewArrival: true });
      ids.push(created.body.data.id as string);
    }
    return ids;
  }

  it("el quinto producto marcado al crear responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    await seedFourNewArrivals(agent, category.id);

    const fifth = await agent.post("/api/v1/admin/products").send({
      name: "Novedad 5",
      description: "Desc",
      categoryId: category.id,
      isNewArrival: true,
      variants: [{ sku: "NOV-5", name: "30 ml", price: 34900, weightGrams: 150 }],
    });

    expect(fifth.status).toBe(409);
    expect(fifth.body.message).toContain("4 novedades");
    expect(fifth.body.errors.isNewArrival).toContain("4 novedades");
  });

  it("marcar un quinto por PATCH responde 409, pero re-guardar uno ya marcado no", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const [first] = await seedFourNewArrivals(agent, category.id);
    const extra = await createProduct(agent, category.id, "Sérum extra", "EXT-1");

    const blocked = await agent.patch(`/api/v1/admin/products/${extra.body.data.id}`).send({ isNewArrival: true });
    const resaved = await agent.patch(`/api/v1/admin/products/${first}`).send({ isNewArrival: true, brandId: await ensureBrand(agent, "Anua") });

    expect(blocked.status).toBe(409);
    expect(resaved.status).toBe(200);
  });

  it("quitar la marca o archivar un producto libera el lugar", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const [first, second] = await seedFourNewArrivals(agent, category.id);
    const extra = await createProduct(agent, category.id, "Sérum extra", "EXT-1");
    const markExtra = () => agent.patch(`/api/v1/admin/products/${extra.body.data.id}`).send({ isNewArrival: true });

    await agent.patch(`/api/v1/admin/products/${first}`).send({ isNewArrival: false });
    expect((await markExtra()).status).toBe(200);

    expect((await agent.patch(`/api/v1/admin/products/${second}`).send({ isNewArrival: true })).status).toBe(200);
    await agent.delete(`/api/v1/admin/products/${second}`);
    const another = await createProduct(agent, category.id, "Sérum otro", "OTR-1");
    expect((await agent.patch(`/api/v1/admin/products/${another.body.data.id}`).send({ isNewArrival: true })).status).toBe(200);
  });

  it("un producto solo de suscripción no ocupa lugar (nunca sale en el home)", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    await createProduct(agent, category.id, "Solo caja", "BOX-1", { isNewArrival: true, channel: "subscription" });

    const ids = await seedFourNewArrivals(agent, category.id);

    expect(ids).toHaveLength(4);
  });
});
