import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

describe("routes/admin-brand — CRUD y aplicación a producto", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/brands");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/brands");
    expect(response.status).toBe(403);
  });

  it("rechaza un nombre vacío", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.post("/api/v1/admin/brands").send({ name: "  " });
    expect(response.status).toBe(400);
  });

  it("golden path: crear, listar, buscar, obtener, renombrar y borrar", async () => {
    const { agent } = await createAdminSession(app);

    const create = await agent.post("/api/v1/admin/brands").send({ name: "Cosrx" });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;
    await agent.post("/api/v1/admin/brands").send({ name: "Anua" });

    const list = await agent.get("/api/v1/admin/brands");
    expect(list.body.data.map((brand: { name: string }) => brand.name)).toEqual(["Anua", "Cosrx"]);

    const search = await agent.get("/api/v1/admin/brands").query({ search: "cos" });
    expect(search.body.meta.total).toBe(1);

    const rename = await agent.patch(`/api/v1/admin/brands/${id}`).send({ name: "COSRX" });
    expect(rename.status).toBe(200);
    expect(rename.body.data.name).toBe("COSRX");

    const remove = await agent.delete(`/api/v1/admin/brands/${id}`);
    expect(remove.status).toBe(200);
    expect((await agent.get(`/api/v1/admin/brands/${id}`)).status).toBe(404);
  });

  it("no permite dos marcas con el mismo nombre aunque cambien mayúsculas o acentos", async () => {
    const { agent } = await createAdminSession(app);
    await agent.post("/api/v1/admin/brands").send({ name: "Beauty of Joseon" });

    const duplicate = await agent.post("/api/v1/admin/brands").send({ name: "beauty of joseón" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.errors.name).toBeDefined();
  });

  it("asignar marca al producto copia el nombre, renombrar lo propaga y borrar con productos responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    const brand = await agent.post("/api/v1/admin/brands").send({ name: "Anua" });
    const brandId = brand.body.data.id as string;

    const product = await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Serum iluminador",
      categoryId: category.body.data.id,
      brandId,
      variants: [{ sku: "SER-30ML", name: "30 ml", price: 34900, weightGrams: 150 }],
    });
    expect(product.status).toBe(201);
    expect(product.body.data).toMatchObject({ brandId, brand: "Anua" });
    const productId = product.body.data.id as string;

    await agent.patch(`/api/v1/admin/brands/${brandId}`).send({ name: "Anua Korea" });
    const renamed = await agent.get(`/api/v1/admin/products/${productId}`);
    expect(renamed.body.data.brand).toBe("Anua Korea");

    const blocked = await agent.delete(`/api/v1/admin/brands/${brandId}`);
    expect(blocked.status).toBe(409);

    const cleared = await agent.patch(`/api/v1/admin/products/${productId}`).send({ brandId: null });
    expect(cleared.body.data.brandId).toBeNull();
    expect(cleared.body.data.brand).toBeUndefined();

    expect((await agent.delete(`/api/v1/admin/brands/${brandId}`)).status).toBe(200);
  });

  it("rechaza asignar una marca que no existe", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    const response = await agent.post("/api/v1/admin/products").send({
      name: "Serum",
      description: "Desc",
      categoryId: category.body.data.id,
      brandId: "a".repeat(24),
      variants: [{ sku: "SER-1", name: "30 ml", price: 34900, weightGrams: 150 }],
    });
    expect(response.status).toBe(400);
  });
});
