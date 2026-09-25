import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession } from "../helpers/admin-session.js";

/**
 * Milestone 2.2.3: `listPrice`, `badgeId` y `content` en Bundle — los mismos
 * tres campos que Product tiene desde 2.2.1 (ver
 * admin-product-content-pricing.routes.test.ts), reusando las mismas piezas
 * de validación (catalog-content.validator.ts).
 */
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

async function createProductWithVariant(
  agent: ReturnType<typeof request.agent>,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const category = await agent.post("/api/v1/admin/categories").send({ name: `Cat ${Date.now()}-${Math.random()}` });
  const categoryId = category.body.data.id as string;

  const product = await agent.post("/api/v1/admin/products").send({
    name: `Producto ${Date.now()}-${Math.random()}`,
    description: "desc",
    categoryId,
    variants: [sampleVariant(overrides)],
  });
  return {
    productId: product.body.data.id as string,
    variantId: product.body.data.variants[0].id as string,
  };
}

async function createBadge(agent: ReturnType<typeof request.agent>) {
  const response = await agent.post("/api/v1/admin/badges").send({ text: "Nuevo", color: "success" });
  return response.body.data.id as string;
}

describe("routes/admin-bundle — listPrice, badgeId y content", () => {
  it("acepta listPrice cuando es mayor al precio y lo devuelve en el DTO", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "LP-A" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete con descuento visual",
      description: "desc",
      price: 89900,
      listPrice: 104700,
      items: [{ productId, variantId, quantity: 1 }],
    });

    expect(create.status).toBe(201);
    expect(create.body.data.listPrice).toBe(104700);
    expect(create.body.data.price).toBe(89900);
  });

  it("rechaza listPrice menor o igual al precio, al crear el paquete", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "LP-B" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete inválido",
      description: "desc",
      price: 90000,
      listPrice: 80000,
      items: [{ productId, variantId, quantity: 1 }],
    });

    expect(create.status).toBe(400);
  });

  it("un PATCH que solo cambia listPrice se valida contra el price vigente del bundle", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "LP-C" });
    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete base",
      description: "desc",
      price: 50000,
      items: [{ productId, variantId, quantity: 1 }],
    });
    const id = create.body.data.id as string;

    const invalid = await agent.patch(`/api/v1/admin/bundles/${id}`).send({ listPrice: 40000 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors).toHaveProperty("listPrice");

    const valid = await agent.patch(`/api/v1/admin/bundles/${id}`).send({ listPrice: 60000 });
    expect(valid.status).toBe(200);
    expect(valid.body.data.listPrice).toBe(60000);
  });

  it("listPrice: null limpia el descuento visual", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "LP-D" });
    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete con descuento",
      description: "desc",
      price: 50000,
      listPrice: 60000,
      items: [{ productId, variantId, quantity: 1 }],
    });
    const id = create.body.data.id as string;

    const cleared = await agent.patch(`/api/v1/admin/bundles/${id}`).send({ listPrice: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.listPrice).toBeNull();
  });

  it("acepta un badgeId existente y lo devuelve en el DTO", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "BD-A" });
    const badgeId = await createBadge(agent);

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete con badge",
      description: "desc",
      price: 50000,
      badgeId,
      items: [{ productId, variantId, quantity: 1 }],
    });

    expect(create.status).toBe(201);
    expect(create.body.data.badgeId).toBe(badgeId);
  });

  it("un badgeId inexistente responde 400 y no crea el paquete", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "BD-B" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete con badge falsa",
      description: "desc",
      price: 50000,
      badgeId: "000000000000000000000000",
      items: [{ productId, variantId, quantity: 1 }],
    });

    expect(create.status).toBe(400);
  });

  it("crea el paquete con los cuatro bloques de contenido y los devuelve tal cual", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "CT-A" });

    const content = {
      ingredients: [{ title: "Niacinamida al 10%", text: "Regula la producción de sebo." }],
      routineSteps: [{ title: "Paso 2", text: "Aplica sobre el rostro limpio." }],
      usage: [{ title: "Por la noche", text: "Úsalo después del tónico." }],
      benefits: [{ title: "Rutina completa", text: "Los tres pasos esenciales en un paquete." }],
    };

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete con contenido",
      description: "desc",
      price: 50000,
      content,
      items: [{ productId, variantId, quantity: 1 }],
    });

    expect(create.status).toBe(201);
    expect(create.body.data.content).toEqual(content);
  });

  it("un paquete sin content no trae la clave en el DTO", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "CT-B" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete sin contenido",
      description: "desc",
      price: 50000,
      items: [{ productId, variantId, quantity: 1 }],
    });

    expect(create.status).toBe(201);
    expect(create.body.data).not.toHaveProperty("content");
  });

  it("un PATCH reemplaza solo el bloque de contenido enviado, no borra los demás", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "CT-C" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete contenido parcial",
      description: "desc",
      price: 50000,
      content: {
        ingredients: [{ title: "A", text: "a" }],
        benefits: [{ title: "B", text: "b" }],
      },
      items: [{ productId, variantId, quantity: 1 }],
    });
    const id = create.body.data.id as string;

    const update = await agent.patch(`/api/v1/admin/bundles/${id}`).send({
      content: { ingredients: [{ title: "A2", text: "a2" }] },
    });

    expect(update.status).toBe(200);
    expect(update.body.data.content.ingredients).toEqual([{ title: "A2", text: "a2" }]);
    expect(update.body.data.content.benefits).toEqual([{ title: "B", text: "b" }]);
  });

  it("un elemento de contenido sin título responde 400 en español", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "CT-D" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Paquete contenido inválido",
      description: "desc",
      price: 50000,
      content: { ingredients: [{ title: "", text: "algo" }] },
      items: [{ productId, variantId, quantity: 1 }],
    });

    expect(create.status).toBe(400);
    expect(create.body.errors["content.ingredients.0.title"]).toMatch(/título/i);
  });
});
