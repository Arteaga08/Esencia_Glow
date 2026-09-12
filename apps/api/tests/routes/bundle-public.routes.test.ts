import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { createAdminSession } from "../helpers/admin-session.js";

const app = buildApp();

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

async function seedActiveBundle(agent: ReturnType<typeof request.agent>) {
  const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare" });
  const product = await agent.post("/api/v1/admin/products").send({
    name: "Serum de Vitamina C",
    description: "Serum iluminador",
    categoryId: category.body.data.id,
    variants: [sampleVariant()],
  });
  const productId = product.body.data.id as string;
  const variantId = product.body.data.variants[0].id as string;

  const bundle = await agent.post("/api/v1/admin/bundles").send({
    name: "Rutina Completa",
    description: "Set de skincare",
    price: 99900,
    items: [{ productId, variantId, quantity: 2 }],
  });
  const bundleId = bundle.body.data.id as string;
  await agent.patch(`/api/v1/admin/bundles/${bundleId}`).send({ status: "active" });

  return { bundleId, productId, variantId };
}

describe("routes/bundle-public — listado y detalle", () => {
  it("un bundle en draft no aparece en el listado público", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Draft" });
    const product = await agent.post("/api/v1/admin/products").send({
      name: "Producto Draft",
      description: "desc",
      categoryId: category.body.data.id,
      variants: [sampleVariant({ sku: "DFT-1" })],
    });
    await agent.post("/api/v1/admin/bundles").send({
      name: "Bundle en Borrador",
      description: "desc",
      price: 1000,
      items: [{ productId: product.body.data.id, variantId: product.body.data.variants[0].id, quantity: 1 }],
    });

    const response = await request(app).get("/api/v1/bundles");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it("lista un bundle activo con sus items enriquecidos", async () => {
    const { agent } = await createAdminSession(app);
    await seedActiveBundle(agent);

    const response = await request(app).get("/api/v1/bundles");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);

    const bundle = response.body.data[0];
    expect(bundle.currency).toBe("MXN");
    expect(bundle.items).toHaveLength(1);
    expect(bundle.items[0].name).toContain("Serum de Vitamina C");
    expect(bundle.items[0].quantity).toBe(2);
  });

  it("el DTO público no expone stock ni campos internos", async () => {
    const { agent } = await createAdminSession(app);
    await seedActiveBundle(agent);

    const list = await request(app).get("/api/v1/bundles");
    const body = JSON.stringify(list.body.data);
    expect(body).not.toContain("stockCache");
    expect(body).not.toContain("publicId");
    expect(body).not.toContain("__v");
  });

  it("obtiene un bundle activo por slug", async () => {
    const { agent } = await createAdminSession(app);
    await seedActiveBundle(agent);

    const response = await request(app).get("/api/v1/bundles/rutina-completa");
    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Rutina Completa");
  });

  it("un bundle archivado responde 404 por slug", async () => {
    const { agent } = await createAdminSession(app);
    const { bundleId } = await seedActiveBundle(agent);
    await agent.delete(`/api/v1/admin/bundles/${bundleId}`);

    const response = await request(app).get("/api/v1/bundles/rutina-completa");
    expect(response.status).toBe(404);
  });

  describe("GET /:slug/availability", () => {
    it("responde isAvailable: true cuando el stock alcanza para armar al menos uno", async () => {
      const { agent } = await createAdminSession(app);
      const { productId, variantId } = await seedActiveBundle(agent);
      await agent.patch(`/api/v1/admin/products/${productId}`).send({ status: "active" });
      await Inventory.create({ productId, variantId, sku: "SER-30ML", onHand: 10, reserved: 0 });

      const response = await request(app).get("/api/v1/bundles/rutina-completa/availability");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ isAvailable: true });
    });

    it("responde isAvailable: false sin stock de sus componentes", async () => {
      const { agent } = await createAdminSession(app);
      await seedActiveBundle(agent);

      const response = await request(app).get("/api/v1/bundles/rutina-completa/availability");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ isAvailable: false });
    });

    it("un bundle archivado responde 404", async () => {
      const { agent } = await createAdminSession(app);
      const { bundleId } = await seedActiveBundle(agent);
      await agent.delete(`/api/v1/admin/bundles/${bundleId}`);

      const response = await request(app).get("/api/v1/bundles/rutina-completa/availability");
      expect(response.status).toBe(404);
    });
  });
});
