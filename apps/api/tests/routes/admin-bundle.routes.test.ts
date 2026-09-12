import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

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
  onHand = 10,
) {
  const category = await agent.post("/api/v1/admin/categories").send({ name: `Cat ${Date.now()}-${Math.random()}` });
  const categoryId = category.body.data.id as string;

  const product = await agent.post("/api/v1/admin/products").send({
    name: `Producto ${Date.now()}-${Math.random()}`,
    description: "desc",
    categoryId,
    variants: [sampleVariant(overrides)],
  });
  const productId = product.body.data.id as string;
  const variantId = product.body.data.variants[0].id as string;

  // El producto nace en draft (no vende) y su variante sin fila de inventario
  // (alta híbrida: nadie siembra 0/0 automáticamente) — se publica y se crea
  // la fila vía los endpoints admin, igual que un admin real.
  await agent.patch(`/api/v1/admin/products/${productId}`).send({ status: "active" });
  if (onHand > 0) {
    await agent.post("/api/v1/admin/inventory").send({ productId, variantId, onHand });
  }

  return { productId, variantId };
}

describe("routes/admin-bundle — CRUD", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/bundles");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/bundles");
    expect(response.status).toBe(403);
  });

  it("golden path: crear -> obtener -> actualizar -> archivar", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "GP-A" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Rutina Completa",
      description: "Set de skincare",
      price: 99900,
      items: [{ productId, variantId, quantity: 1 }],
    });
    expect(create.status).toBe(201);
    expect(create.body.data.slug).toBe("rutina-completa");
    expect(create.body.data.status).toBe("draft");
    expect(create.body.data.stockCache).toBe(10);
    const id = create.body.data.id as string;

    const getOne = await agent.get(`/api/v1/admin/bundles/${id}`);
    expect(getOne.status).toBe(200);

    const update = await agent.patch(`/api/v1/admin/bundles/${id}`).send({ status: "active" });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe("active");

    const archive = await agent.delete(`/api/v1/admin/bundles/${id}`);
    expect(archive.status).toBe(200);

    const afterArchive = await agent.get(`/api/v1/admin/bundles/${id}`);
    expect(afterArchive.body.data.status).toBe("archived");
  });

  it("un productId inexistente en items responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const { variantId } = await createProductWithVariant(agent, { sku: "BAD-1" });

    const response = await agent.post("/api/v1/admin/bundles").send({
      name: "Bundle Roto",
      description: "desc",
      price: 1000,
      items: [{ productId: "000000000000000000000000", variantId, quantity: 1 }],
    });
    expect(response.status).toBe(400);
  });

  it("dos líneas con la misma variante en el payload responden 400 (validación)", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "DUP-1" });

    const response = await agent.post("/api/v1/admin/bundles").send({
      name: "Bundle Duplicado",
      description: "desc",
      price: 1000,
      items: [
        { productId, variantId, quantity: 1 },
        { productId, variantId, quantity: 2 },
      ],
    });
    expect(response.status).toBe(400);
  });

  it("un bundle sin items responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.post("/api/v1/admin/bundles").send({
      name: "Bundle Vacío",
      description: "desc",
      price: 1000,
      items: [],
    });
    expect(response.status).toBe(400);
  });

  it("reemplazar items por PATCH recalcula stockCache", async () => {
    const { agent } = await createAdminSession(app);
    const first = await createProductWithVariant(agent, { sku: "REPL-A" });
    const second = await createProductWithVariant(agent, { sku: "REPL-B" });

    const create = await agent.post("/api/v1/admin/bundles").send({
      name: "Bundle Reemplazable",
      description: "desc",
      price: 1000,
      items: [{ productId: first.productId, variantId: first.variantId, quantity: 1 }],
    });
    const id = create.body.data.id as string;

    const update = await agent.patch(`/api/v1/admin/bundles/${id}`).send({
      items: [{ productId: second.productId, variantId: second.variantId, quantity: 2 }],
    });
    expect(update.status).toBe(200);
    expect(update.body.data.items).toHaveLength(1);
    expect(update.body.data.items[0].productId).toBe(second.productId);
    expect(update.body.data.stockCache).toBe(5); // floor(10/2)
  });

  it("listado con meta correcta y búsqueda por nombre", async () => {
    const { agent } = await createAdminSession(app);
    const { productId, variantId } = await createProductWithVariant(agent, { sku: "LIST-A" });

    await agent.post("/api/v1/admin/bundles").send({
      name: "Set de Verano",
      description: "desc",
      price: 1000,
      items: [{ productId, variantId, quantity: 1 }],
    });
    await agent.post("/api/v1/admin/bundles").send({
      name: "Set de Invierno",
      description: "desc",
      price: 1000,
      items: [{ productId, variantId, quantity: 1 }],
    });

    const all = await agent.get("/api/v1/admin/bundles");
    expect(all.body.meta.total).toBe(2);

    const bySearch = await agent.get("/api/v1/admin/bundles").query({ search: "verano" });
    expect(bySearch.body.data).toHaveLength(1);
    expect(bySearch.body.data[0].name).toBe("Set de Verano");
  });
});
