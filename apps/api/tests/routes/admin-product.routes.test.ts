import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

async function createCategory(agent: ReturnType<typeof request.agent>) {
  const response = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
  return response.body.data.id as string;
}

function sampleVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sku: "SER-30ML",
    name: "30 ml",
    price: 34900,
    weightGrams: 150,
    dimensionsCm: { length: 5, width: 5, height: 10 },
    ...overrides,
  };
}

describe("routes/admin-product — CRUD, variantes y filtros", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/products");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/products");
    expect(response.status).toBe(403);
  });

  it("golden path: crear -> obtener -> actualizar -> archivar", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Serum iluminador",
      categoryId,
      variants: [sampleVariant()],
    });
    expect(create.status).toBe(201);
    expect(create.body.data.slug).toBe("serum-de-vitamina-c");
    expect(create.body.data.minPrice).toBe(34900);
    expect(create.body.data.status).toBe("draft");
    const id = create.body.data.id as string;

    const getOne = await agent.get(`/api/v1/admin/products/${id}`);
    expect(getOne.status).toBe(200);

    const update = await agent.patch(`/api/v1/admin/products/${id}`).send({ status: "active" });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe("active");

    const archive = await agent.delete(`/api/v1/admin/products/${id}`);
    expect(archive.status).toBe(200);

    const afterArchive = await agent.get(`/api/v1/admin/products/${id}`);
    expect(afterArchive.body.data.status).toBe("archived");
  });

  it("un slug duplicado (mismo nombre) responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const payload = {
      name: "Serum de Vitamina C",
      description: "Serum iluminador",
      categoryId,
      variants: [sampleVariant()],
    };
    await agent.post("/api/v1/admin/products").send(payload);
    const dup = await agent
      .post("/api/v1/admin/products")
      .send({ ...payload, variants: [sampleVariant({ sku: "SER-50ML" })] });
    expect(dup.status).toBe(409);
  });

  it("un SKU repetido entre dos productos responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    await agent.post("/api/v1/admin/products").send({
      name: "Serum A",
      description: "Descripción A",
      categoryId,
      variants: [sampleVariant()],
    });
    const dup = await agent.post("/api/v1/admin/products").send({
      name: "Serum B",
      description: "Descripción B",
      categoryId,
      variants: [sampleVariant()],
    });
    expect(dup.status).toBe(409);
  });

  it("un SKU repetido dentro del mismo payload responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum C",
      description: "Descripción C",
      categoryId,
      variants: [sampleVariant(), sampleVariant({ name: "50 ml" })],
    });
    expect(create.status).toBe(400);
  });

  it("agrega, actualiza y elimina una variante por subruta", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Serum iluminador",
      categoryId,
      variants: [sampleVariant()],
    });
    const id = create.body.data.id as string;

    const addVariant = await agent
      .post(`/api/v1/admin/products/${id}/variants`)
      .send(sampleVariant({ sku: "SER-50ML", name: "50 ml", price: 49900 }));
    expect(addVariant.status).toBe(201);
    expect(addVariant.body.data.variants).toHaveLength(2);
    expect(addVariant.body.data.minPrice).toBe(34900);

    const variantId = addVariant.body.data.variants[1].id as string;
    const updateVariant = await agent
      .patch(`/api/v1/admin/products/${id}/variants/${variantId}`)
      .send({ price: 10000 });
    expect(updateVariant.status).toBe(200);
    expect(updateVariant.body.data.minPrice).toBe(10000);

    const removeVariant = await agent.delete(
      `/api/v1/admin/products/${id}/variants/${variantId}`,
    );
    expect(removeVariant.status).toBe(200);
    expect(removeVariant.body.data.variants).toHaveLength(1);
  });

  it("agregar un SKU duplicado a un producto existente responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Serum iluminador",
      categoryId,
      variants: [sampleVariant()],
    });
    const id = create.body.data.id as string;

    const dup = await agent.post(`/api/v1/admin/products/${id}/variants`).send(sampleVariant());
    expect(dup.status).toBe(409);
  });

  it("listado con meta correcta y búsqueda por nombre y SKU", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Descripción",
      categoryId,
      variants: [sampleVariant()],
    });
    await agent.post("/api/v1/admin/products").send({
      name: "Crema Hidratante",
      description: "Descripción",
      categoryId,
      variants: [sampleVariant({ sku: "CRM-100ML" })],
    });

    const all = await agent.get("/api/v1/admin/products");
    expect(all.body.meta.total).toBe(2);

    const byName = await agent.get("/api/v1/admin/products").query({ search: "vitamina" });
    expect(byName.body.data).toHaveLength(1);

    const bySku = await agent.get("/api/v1/admin/products").query({ search: "CRM-100ML" });
    expect(bySku.body.data).toHaveLength(1);
    expect(bySku.body.data[0].name).toBe("Crema Hidratante");
  });

  it("un sort con formato válido pero fuera de whitelist (password) cae al orden default sin 500", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get("/api/v1/admin/products").query({ sort: "password" });
    expect(response.status).toBe(200);
  });

  it("un sort con formato inválido (__proto__, guiones bajos) es rechazado en la validación, nunca 500", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get("/api/v1/admin/products").query({ sort: "__proto__" });
    expect(response.status).toBe(400);
  });

  it("un limit fuera de rango se topa en 100", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get("/api/v1/admin/products").query({ limit: 9999 });
    expect(response.status).toBe(200);
    expect(response.body.meta.limit).toBe(100);
  });

  it("filtra por categoría, status y rango de precio", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Descripción",
      categoryId,
      variants: [sampleVariant()],
    });
    const id = create.body.data.id as string;
    await agent.patch(`/api/v1/admin/products/${id}`).send({ status: "active" });

    const byCategory = await agent.get("/api/v1/admin/products").query({ categoryId });
    expect(byCategory.body.meta.total).toBe(1);

    const byStatus = await agent.get("/api/v1/admin/products").query({ status: "active" });
    expect(byStatus.body.meta.total).toBe(1);

    const byPrice = await agent
      .get("/api/v1/admin/products")
      .query({ minPrice: 1, maxPrice: 34900 });
    expect(byPrice.body.meta.total).toBe(1);

    const byPriceMiss = await agent
      .get("/api/v1/admin/products")
      .query({ minPrice: 100000 });
    expect(byPriceMiss.body.meta.total).toBe(0);
  });
});
