import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession } from "../helpers/admin-session.js";

/**
 * Milestone 2.2.1: `listPrice` (precio de lista, solo presentación) y
 * `content` (ingredientes/pasos de rutina/modo de uso/beneficios). Ver
 * product.validator.ts y product-variant.service.ts.
 */
const app = buildApp();

async function createCategory(agent: ReturnType<typeof request.agent>) {
  const response = await agent.post("/api/v1/admin/categories").send({ name: "Skincare" });
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

describe("routes/admin-product — listPrice y content", () => {
  it("acepta listPrice cuando es mayor al precio y lo devuelve en el DTO", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum con descuento visual",
      description: "desc",
      categoryId,
      variants: [sampleVariant({ listPrice: 45000 })],
    });

    expect(create.status).toBe(201);
    expect(create.body.data.variants[0].listPrice).toBe(45000);
    expect(create.body.data.variants[0].price).toBe(34900);
  });

  it("rechaza listPrice menor o igual al precio, al crear el producto", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Producto inválido",
      description: "desc",
      categoryId,
      variants: [sampleVariant({ listPrice: 30000 })],
    });

    expect(create.status).toBe(400);
    expect(create.body.errors).toHaveProperty("variants.0");
  });

  it("rechaza listPrice igual al precio al agregar una variante por separado", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const create = await agent.post("/api/v1/admin/products").send({
      name: "Producto base",
      description: "desc",
      categoryId,
      variants: [sampleVariant()],
    });
    const productId = create.body.data.id as string;

    const addVariant = await agent.post(`/api/v1/admin/products/${productId}/variants`).send(
      sampleVariant({ sku: "SER-50ML", listPrice: 34900 }),
    );

    expect(addVariant.status).toBe(400);
  });

  it("un PATCH que solo cambia listPrice se valida contra el price vigente de la variante", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const create = await agent.post("/api/v1/admin/products").send({
      name: "Producto base 2",
      description: "desc",
      categoryId,
      variants: [sampleVariant({ price: 20000 })],
    });
    const productId = create.body.data.id as string;
    const variantId = create.body.data.variants[0].id as string;

    const invalid = await agent
      .patch(`/api/v1/admin/products/${productId}/variants/${variantId}`)
      .send({ listPrice: 15000 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors).toHaveProperty("listPrice");

    const valid = await agent
      .patch(`/api/v1/admin/products/${productId}/variants/${variantId}`)
      .send({ listPrice: 25000 });
    expect(valid.status).toBe(200);

    const variant = valid.body.data.variants.find((v: { id: string }) => v.id === variantId);
    expect(variant.listPrice).toBe(25000);
  });

  it("listPrice: null limpia el descuento visual", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);
    const create = await agent.post("/api/v1/admin/products").send({
      name: "Producto con descuento",
      description: "desc",
      categoryId,
      variants: [sampleVariant({ listPrice: 45000 })],
    });
    const productId = create.body.data.id as string;
    const variantId = create.body.data.variants[0].id as string;

    const cleared = await agent
      .patch(`/api/v1/admin/products/${productId}/variants/${variantId}`)
      .send({ listPrice: null });

    expect(cleared.status).toBe(200);
    const variant = cleared.body.data.variants.find((v: { id: string }) => v.id === variantId);
    expect(variant.listPrice).toBeNull();
  });

  it("crea el producto con los cuatro bloques de contenido y los devuelve tal cual", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const content = {
      ingredients: [{ title: "Niacinamida al 10%", text: "Regula la producción de sebo." }],
      routineSteps: [{ title: "Paso 2", text: "Aplica 3 gotas sobre el rostro limpio." }],
      usage: [{ title: "Por la noche", text: "Úsalo después del tónico." }],
      benefits: [{ title: "Hidratación profunda", text: "Retiene humedad por 24 horas." }],
    };

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum con contenido",
      description: "desc",
      categoryId,
      content,
      variants: [sampleVariant()],
    });

    expect(create.status).toBe(201);
    expect(create.body.data.content).toEqual(content);
  });

  it("un producto sin content no trae la clave en el DTO", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum sin contenido",
      description: "desc",
      categoryId,
      variants: [sampleVariant({ sku: "NC-1" })],
    });

    expect(create.status).toBe(201);
    expect(create.body.data).not.toHaveProperty("content");
  });

  it("un PATCH reemplaza solo el bloque de contenido enviado, no borra los demás", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum contenido parcial",
      description: "desc",
      categoryId,
      content: {
        ingredients: [{ title: "A", text: "a" }],
        benefits: [{ title: "B", text: "b" }],
      },
      variants: [sampleVariant({ sku: "PC-1" })],
    });
    const productId = create.body.data.id as string;

    const update = await agent.patch(`/api/v1/admin/products/${productId}`).send({
      content: { ingredients: [{ title: "A2", text: "a2" }] },
    });

    expect(update.status).toBe(200);
    expect(update.body.data.content.ingredients).toEqual([{ title: "A2", text: "a2" }]);
    expect(update.body.data.content.benefits).toEqual([{ title: "B", text: "b" }]);
  });

  it("un elemento de contenido sin título o con texto vacío responde 400 en español", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum contenido inválido",
      description: "desc",
      categoryId,
      content: { ingredients: [{ title: "", text: "algo" }] },
      variants: [sampleVariant({ sku: "INV-1" })],
    });

    expect(create.status).toBe(400);
    expect(create.body.errors["content.ingredients.0.title"]).toMatch(/título/i);
  });

  it("mensajes de error de variante están en español, no el default de Joi", async () => {
    const { agent } = await createAdminSession(app);
    const categoryId = await createCategory(agent);

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Producto peso inválido",
      description: "desc",
      categoryId,
      variants: [sampleVariant({ sku: "WG-1", weightGrams: 0 })],
    });

    expect(create.status).toBe(400);
    const message = create.body.errors["variants.0.weightGrams"] as string;
    expect(message).not.toMatch(/must be/i);
    expect(message).toMatch(/gramo/i);
  });
});
