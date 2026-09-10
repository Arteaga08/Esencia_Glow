import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

describe("routes/admin-badge — CRUD y aplicación a producto", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/badges");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/badges");
    expect(response.status).toBe(403);
  });

  it("rechaza un color fuera de la paleta fija", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .post("/api/v1/admin/badges")
      .send({ text: "Nuevo", color: "fucsia" });
    expect(response.status).toBe(400);
  });

  it("golden path: crear, listar, obtener, actualizar y borrar", async () => {
    const { agent } = await createAdminSession(app);

    const create = await agent.post("/api/v1/admin/badges").send({ text: "Nuevo", color: "success" });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;
    expect(create.body.data).toMatchObject({ text: "Nuevo", color: "success" });

    const list = await agent.get("/api/v1/admin/badges");
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);

    const getOne = await agent.get(`/api/v1/admin/badges/${id}`);
    expect(getOne.status).toBe(200);

    const update = await agent.patch(`/api/v1/admin/badges/${id}`).send({ color: "warning" });
    expect(update.status).toBe(200);
    expect(update.body.data.color).toBe("warning");

    const remove = await agent.delete(`/api/v1/admin/badges/${id}`);
    expect(remove.status).toBe(200);

    const afterDelete = await agent.get(`/api/v1/admin/badges/${id}`);
    expect(afterDelete.status).toBe(404);
  });

  it("asignar una badge a un producto reemplaza la anterior y borra al desasignar", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    const categoryId = category.body.data.id as string;

    const badgeA = await agent.post("/api/v1/admin/badges").send({ text: "Nuevo", color: "success" });
    const badgeB = await agent.post("/api/v1/admin/badges").send({ text: "Más vendido", color: "warning" });

    const product = await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Serum iluminador",
      categoryId,
      badgeId: badgeA.body.data.id,
      variants: [
        {
          sku: "SER-30ML",
          name: "30 ml",
          price: 34900,
          weightGrams: 150,
          dimensionsCm: { length: 5, width: 5, height: 10 },
        },
      ],
    });
    expect(product.status).toBe(201);
    expect(product.body.data.badgeId).toBe(badgeA.body.data.id);

    const productId = product.body.data.id as string;
    const reassign = await agent
      .patch(`/api/v1/admin/products/${productId}`)
      .send({ badgeId: badgeB.body.data.id });
    expect(reassign.body.data.badgeId).toBe(badgeB.body.data.id);

    const unassign = await agent.patch(`/api/v1/admin/products/${productId}`).send({ badgeId: null });
    expect(unassign.body.data.badgeId).toBeNull();
  });

  it("asignar un badgeId inexistente responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    const categoryId = category.body.data.id as string;
    const fakeBadgeId = "aaaaaaaaaaaaaaaaaaaaaaaa";

    const product = await agent.post("/api/v1/admin/products").send({
      name: "Serum de Vitamina C",
      description: "Serum iluminador",
      categoryId,
      badgeId: fakeBadgeId,
      variants: [
        {
          sku: "SER-30ML",
          name: "30 ml",
          price: 34900,
          weightGrams: 150,
          dimensionsCm: { length: 5, width: 5, height: 10 },
        },
      ],
    });
    expect(product.status).toBe(400);
  });
});
