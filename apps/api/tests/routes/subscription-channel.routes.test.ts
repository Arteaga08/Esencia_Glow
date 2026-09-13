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

const destination = {
  fullName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma",
  exteriorNumber: "100",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
};

async function createSubscriptionProduct(agent: ReturnType<typeof request.agent>, categoryId: string) {
  const create = await agent.post("/api/v1/admin/products").send({
    name: "Caja Esencial de Septiembre",
    description: "Contenido exclusivo de la caja",
    categoryId,
    channel: "subscription",
    variants: [sampleVariant()],
  });
  await agent.patch(`/api/v1/admin/products/${create.body.data.id}`).send({ status: "active" });
  return create.body.data as { id: string; slug: string; variants: { id: string }[] };
}

describe("routes/subscription-channel — blindaje del canal de suscripción", () => {
  it("el admin puede crear un producto de canal suscripción", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Cajas" });
    const categoryId = category.body.data.id as string;

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Caja Esencial",
      description: "d",
      categoryId,
      channel: "subscription",
      variants: [sampleVariant()],
    });

    expect(create.status).toBe(201);
    expect(create.body.data.channel).toBe("subscription");
  });

  it("un producto sin channel se crea como store por default", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Normal" });

    const create = await agent.post("/api/v1/admin/products").send({
      name: "Serum Normal",
      description: "d",
      categoryId: category.body.data.id,
      variants: [sampleVariant({ sku: "SER-A" })],
    });

    expect(create.body.data.channel).toBe("store");
  });

  it("GET /admin/products?channel=subscription filtra solo los de ese canal", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Filtro Canal" });
    const categoryId = category.body.data.id as string;
    await createSubscriptionProduct(agent, categoryId);
    await agent.post("/api/v1/admin/products").send({
      name: "Producto de Tienda",
      description: "d",
      categoryId,
      variants: [sampleVariant({ sku: "STORE-A" })],
    });

    const onlySubscription = await agent.get("/api/v1/admin/products").query({ channel: "subscription" });
    expect(onlySubscription.body.data).toHaveLength(1);
    expect(onlySubscription.body.data[0].channel).toBe("subscription");

    const all = await agent.get("/api/v1/admin/products");
    expect(all.body.data).toHaveLength(2);
  });

  it("un producto de canal suscripción no aparece en el catálogo público ni por slug", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Cajas Públicas" });
    const product = await createSubscriptionProduct(agent, category.body.data.id);

    const list = await request(app).get("/api/v1/products");
    expect(list.body.data.map((p: { id: string }) => p.id)).not.toContain(product.id);

    const bySlug = await request(app).get(`/api/v1/products/${product.slug}`);
    expect(bySlug.status).toBe(404);

    const availability = await request(app).get(`/api/v1/products/${product.slug}/availability`);
    expect(availability.status).toBe(404);
  });

  it("no se puede cotizar envío para un producto de canal suscripción", async () => {
    const { agent: adminAgent } = await createAdminSession(app);
    const category = await adminAgent.post("/api/v1/admin/categories").send({ name: "Cajas Envío" });
    const product = await createSubscriptionProduct(adminAgent, category.body.data.id);

    const { agent: customerAgent } = await createCustomerSession(app);
    const quote = await customerAgent.post("/api/v1/shipping/quotes").send({
      destination,
      lines: [{ itemType: "product", itemId: product.variants[0]!.id, quantity: 1 }],
    });

    expect(quote.status).toBe(409);
  });

  it("cambiar un producto de tienda a suscripción se rechaza si está dentro de un bundle activo", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Bundle Guard" });
    const categoryId = category.body.data.id as string;

    const product = await agent.post("/api/v1/admin/products").send({
      name: "Componente de Bundle",
      description: "d",
      categoryId,
      variants: [sampleVariant({ sku: "COMP-A" })],
    });
    const productId = product.body.data.id as string;
    const variantId = product.body.data.variants[0].id as string;

    await agent.post("/api/v1/admin/bundles").send({
      name: "Kit con este producto",
      description: "d",
      price: 1000,
      items: [{ productId, variantId, quantity: 1 }],
    });

    const changeChannel = await agent
      .patch(`/api/v1/admin/products/${productId}`)
      .send({ channel: "subscription" });

    expect(changeChannel.status).toBe(409);
  });
});
