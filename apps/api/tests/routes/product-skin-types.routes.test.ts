import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { createAdminSession } from "../helpers/admin-session.js";

const app = buildApp();

type Agent = ReturnType<typeof request.agent>;

async function createProduct(agent: Agent, categoryId: string, name: string, sku: string, skinTypes?: unknown) {
  return agent.post("/api/v1/admin/products").send({
    name,
    description: "Desc",
    categoryId,
    variants: [{ sku, name: "30 ml", price: 34900, weightGrams: 150 }],
    ...(skinTypes !== undefined ? { skinTypes } : {}),
  });
}

describe("routes/products — tipos de piel", () => {
  it("nace sin tipos de piel y acepta varios al crear y al editar", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });

    const plain = await createProduct(agent, category.id, "Sérum A", "SER-A1");
    expect(plain.body.data.skinTypes).toEqual([]);

    const created = await createProduct(agent, category.id, "Sérum B", "SER-B1", [" Seca ", "Mixta"]);
    expect(created.status).toBe(201);
    expect(created.body.data.skinTypes).toEqual(["Seca", "Mixta"]);

    const updated = await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ skinTypes: ["Grasa"] });
    expect(updated.body.data.skinTypes).toEqual(["Grasa"]);

    const cleared = await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ skinTypes: [] });
    expect(cleared.body.data.skinTypes).toEqual([]);
  });

  it("rechaza repetidos, vacíos y más de 10", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });

    const repeated = await createProduct(agent, category.id, "Sérum A", "SER-A1", ["Seca", "seca"]);
    expect(repeated.status).toBe(400);
    const empty = await createProduct(agent, category.id, "Sérum A", "SER-A1", ["  "]);
    expect(empty.status).toBe(400);
    const tooMany = await createProduct(
      agent,
      category.id,
      "Sérum A",
      "SER-A1",
      Array.from({ length: 11 }, (_, index) => `Tipo ${index}`),
    );
    expect(tooMany.status).toBe(400);
  });

  it("GET /skin-types junta lo ya escrito sin repetir y en orden", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    await createProduct(agent, category.id, "Sérum A", "SER-A1", ["Seca", "Mixta"]);
    await createProduct(agent, category.id, "Sérum B", "SER-B1", ["Mixta", "Grasa"]);

    const response = await agent.get("/api/v1/admin/products/skin-types");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(["Grasa", "Mixta", "Seca"]);
  });

  it("GET /skin-types exige sesión de admin", async () => {
    const response = await request(app).get("/api/v1/admin/products/skin-types");
    expect(response.status).toBe(401);
  });

  it("el catálogo público expone los tipos de piel solo si hay", async () => {
    const { agent } = await createAdminSession(app);
    const category = await Category.create({ name: "Sueros", slug: "sueros", isActive: true });
    const withTypes = await createProduct(agent, category.id, "Sérum A", "SER-A1", ["Sensible"]);
    const without = await createProduct(agent, category.id, "Sérum B", "SER-B1");
    for (const product of [withTypes, without]) {
      await agent.patch(`/api/v1/admin/products/${product.body.data.id}`).send({ status: "active" });
    }

    const a = await request(app).get(`/api/v1/products/${withTypes.body.data.slug}`);
    const b = await request(app).get(`/api/v1/products/${without.body.data.slug}`);

    expect(a.body.data.skinTypes).toEqual(["Sensible"]);
    expect(b.body.data).not.toHaveProperty("skinTypes");
  });
});
