import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

describe("routes/admin-category — CRUD y jerarquía vía HTTP", () => {
  it("sin cookie responde 401", async () => {
    const request = (await import("supertest")).default;
    const response = await request(app).get("/api/v1/admin/categories");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/categories");
    expect(response.status).toBe(403);
  });

  it("golden path: crear, listar, obtener, actualizar y borrar", async () => {
    const { agent } = await createAdminSession(app);

    const create = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;
    expect(create.body.data.slug).toBe("skincare-coreano");

    const list = await agent.get("/api/v1/admin/categories");
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(Array.isArray(list.body.data)).toBe(true);

    const getOne = await agent.get(`/api/v1/admin/categories/${id}`);
    expect(getOne.status).toBe(200);
    expect(getOne.body.data.name).toBe("Skincare Coreano");

    const update = await agent
      .patch(`/api/v1/admin/categories/${id}`)
      .send({ sortOrder: 5 });
    expect(update.status).toBe(200);
    expect(update.body.data.sortOrder).toBe(5);

    const remove = await agent.delete(`/api/v1/admin/categories/${id}`);
    expect(remove.status).toBe(200);

    const afterDelete = await agent.get(`/api/v1/admin/categories/${id}`);
    expect(afterDelete.status).toBe(404);
  });

  it("respeta el orden por sortOrder y refleja la jerarquía en el listado", async () => {
    const { agent } = await createAdminSession(app);

    const root = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    const rootId = root.body.data.id as string;
    await agent.post("/api/v1/admin/categories").send({ name: "Serums", parentId: rootId, sortOrder: 2 });
    await agent.post("/api/v1/admin/categories").send({ name: "Limpiadores", parentId: rootId, sortOrder: 1 });

    const list = await agent.get("/api/v1/admin/categories").query({ sort: "sortOrder" });
    expect(list.status).toBe(200);
    const names = list.body.data.map((c: { name: string }) => c.name);
    expect(names.indexOf("Limpiadores")).toBeLessThan(names.indexOf("Serums"));

    const children = list.body.data.filter((c: { parentId: string | null }) => c.parentId === rootId);
    expect(children).toHaveLength(2);
  });

  it("crear una nieta vía HTTP responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const root = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    const rootId = root.body.data.id as string;
    const child = await agent.post("/api/v1/admin/categories").send({ name: "Serums", parentId: rootId });
    const childId = child.body.data.id as string;

    const grandchild = await agent
      .post("/api/v1/admin/categories")
      .send({ name: "Vitamina C", parentId: childId });
    expect(grandchild.status).toBe(400);
  });

  it("un slug duplicado responde 409", async () => {
    const { agent } = await createAdminSession(app);
    await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    const dup = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
    expect(dup.status).toBe(409);
  });
});
