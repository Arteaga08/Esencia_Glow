import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

function sampleVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sku: "BOX-30ML",
    name: "30 ml",
    price: 34900,
    weightGrams: 150,
    dimensionsCm: { length: 5, width: 5, height: 10 },
    ...overrides,
  };
}

async function seedPlanAndProduct(agent: ReturnType<typeof request.agent>) {
  const plan = await agent.post("/api/v1/admin/subscription-plans").send({
    name: "Caja Esencial",
    description: "d",
    priceCents: 49900,
    maxActiveSeats: 100,
  });
  const category = await agent.post("/api/v1/admin/categories").send({ name: "Cajas" });
  const product = await agent.post("/api/v1/admin/products").send({
    name: "Producto Exclusivo",
    description: "d",
    categoryId: category.body.data.id,
    channel: "subscription",
    variants: [sampleVariant()],
  });
  await agent.patch(`/api/v1/admin/products/${product.body.data.id}`).send({ status: "active" });

  return {
    planId: plan.body.data.id as string,
    productId: product.body.data.id as string,
    variantId: product.body.data.variants[0].id as string,
  };
}

describe("routes/admin-subscription-edition — CRUD y curaduría", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/subscription-editions");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/subscription-editions");
    expect(response.status).toBe(403);
  });

  it("cycleMonth fuera de 1-12 responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const { planId } = await seedPlanAndProduct(agent);
    const response = await agent
      .post("/api/v1/admin/subscription-editions")
      .send({ planId, cycleYear: 2026, cycleMonth: 13, title: "Sept" });
    expect(response.status).toBe(400);
  });

  it("golden path completo: crear -> agregar items -> publicar", async () => {
    const { agent } = await createAdminSession(app);
    const { planId, productId, variantId } = await seedPlanAndProduct(agent);

    const create = await agent
      .post("/api/v1/admin/subscription-editions")
      .send({ planId, cycleYear: 2026, cycleMonth: 9, title: "Esencial · Septiembre" });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("draft");
    const id = create.body.data.id as string;

    const patchItems = await agent
      .patch(`/api/v1/admin/subscription-editions/${id}`)
      .send({ items: [{ productId, variantId, quantity: 1 }] });
    expect(patchItems.status).toBe(200);
    expect(patchItems.body.data.items).toHaveLength(1);

    const publish = await agent.post(`/api/v1/admin/subscription-editions/${id}/publish`);
    expect(publish.status).toBe(200);
    expect(publish.body.data.status).toBe("published");
  });

  it("publicar con un producto de canal tienda responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const { planId } = await seedPlanAndProduct(agent);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Tienda Normal" });
    const storeProduct = await agent.post("/api/v1/admin/products").send({
      name: "Producto de Tienda",
      description: "d",
      categoryId: category.body.data.id,
      variants: [sampleVariant({ sku: "STORE-A" })],
    });
    await agent.patch(`/api/v1/admin/products/${storeProduct.body.data.id}`).send({ status: "active" });

    const create = await agent
      .post("/api/v1/admin/subscription-editions")
      .send({ planId, cycleYear: 2026, cycleMonth: 10, title: "Oct" });
    const id = create.body.data.id as string;
    await agent.patch(`/api/v1/admin/subscription-editions/${id}`).send({
      items: [
        {
          productId: storeProduct.body.data.id,
          variantId: storeProduct.body.data.variants[0].id,
          quantity: 1,
        },
      ],
    });

    const publish = await agent.post(`/api/v1/admin/subscription-editions/${id}/publish`);
    expect(publish.status).toBe(400);
  });

  it("segunda edición del mismo plan y ciclo responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const { planId } = await seedPlanAndProduct(agent);
    await agent
      .post("/api/v1/admin/subscription-editions")
      .send({ planId, cycleYear: 2026, cycleMonth: 11, title: "Nov" });

    const duplicate = await agent
      .post("/api/v1/admin/subscription-editions")
      .send({ planId, cycleYear: 2026, cycleMonth: 11, title: "Nov 2" });
    expect(duplicate.status).toBe(409);
  });

  it("GET /:id inexistente responde 404", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get("/api/v1/admin/subscription-editions/aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(response.status).toBe(404);
  });

  it("DELETE sobre una edición DRAFT la elimina; sobre PUBLISHED responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const { planId, productId, variantId } = await seedPlanAndProduct(agent);

    const draft = await agent
      .post("/api/v1/admin/subscription-editions")
      .send({ planId, cycleYear: 2027, cycleMonth: 1, title: "Enero" });
    const draftDelete = await agent.delete(`/api/v1/admin/subscription-editions/${draft.body.data.id}`);
    expect(draftDelete.status).toBe(200);

    const published = await agent
      .post("/api/v1/admin/subscription-editions")
      .send({ planId, cycleYear: 2027, cycleMonth: 2, title: "Febrero" });
    await agent
      .patch(`/api/v1/admin/subscription-editions/${published.body.data.id}`)
      .send({ items: [{ productId, variantId, quantity: 1 }] });
    await agent.post(`/api/v1/admin/subscription-editions/${published.body.data.id}/publish`);

    const publishedDelete = await agent.delete(`/api/v1/admin/subscription-editions/${published.body.data.id}`);
    expect(publishedDelete.status).toBe(409);
  });
});
