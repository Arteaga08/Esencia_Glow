import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
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

async function seedCatalog(agent: ReturnType<typeof request.agent>) {
  const root = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
  const rootId = root.body.data.id as string;
  await agent.post("/api/v1/admin/categories").send({ name: "Serums", parentId: rootId, sortOrder: 1 });

  const active = await agent.post("/api/v1/admin/products").send({
    name: "Serum de Vitamina C",
    description: "Serum iluminador",
    categoryId: rootId,
    variants: [sampleVariant()],
  });
  await agent.patch(`/api/v1/admin/products/${active.body.data.id}`).send({ status: "active" });

  // Producto draft: nunca debe salir en público.
  await agent.post("/api/v1/admin/products").send({
    name: "Crema en Borrador",
    description: "Aún no publicada",
    categoryId: rootId,
    variants: [sampleVariant({ sku: "DRF-100ML" })],
  });

  // Producto activo pero con todas sus variantes inactivas: tampoco debe salir.
  const allInactive = await agent.post("/api/v1/admin/products").send({
    name: "Producto Sin Stock Visible",
    description: "Todas las variantes apagadas",
    categoryId: rootId,
    variants: [sampleVariant({ sku: "OFF-100ML", isActive: false })],
  });
  await agent.patch(`/api/v1/admin/products/${allInactive.body.data.id}`).send({ status: "active" });

  return { rootId };
}

describe("routes/catalog-public — productos y categorías", () => {
  it("solo devuelve productos activos con al menos una variante activa", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent);

    const response = await request(app).get("/api/v1/products");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Serum de Vitamina C");
  });

  it("un producto en borrador responde 404 por slug", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent);

    const response = await request(app).get("/api/v1/products/crema-en-borrador");
    expect(response.status).toBe(404);
  });

  it("el DTO público no expone campos internos", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent);

    const response = await request(app).get("/api/v1/products/serum-de-vitamina-c");
    expect(response.status).toBe(200);
    const body = JSON.stringify(response.body.data);
    expect(body).not.toContain("publicId");
    expect(body).not.toContain("\"status\"");
    expect(body).not.toContain("isActive");
    expect(body).not.toContain("__v");
    expect(response.body.data.currency).toBe("MXN");
    expect(response.body.data.category).toMatchObject({ slug: "skincare-coreano" });
  });

  it("filtrar por la categoría raíz incluye productos de sus subcategorías", async () => {
    const { agent } = await createAdminSession(app);
    const { rootId } = await seedCatalog(agent);
    const rootCategory = await agent.get(`/api/v1/admin/categories/${rootId}`);

    const bySlug = await request(app)
      .get("/api/v1/products")
      .query({ category: rootCategory.body.data.slug });
    expect(bySlug.body.data).toHaveLength(1);
  });

  it("el árbol de categorías trae children", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent);

    const response = await request(app).get("/api/v1/categories");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].children).toHaveLength(1);
    expect(response.body.data[0].children[0].name).toBe("Serums");
  });

  it("una categoría inactiva no aparece en el árbol ni por slug", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Oculta" });
    await agent
      .patch(`/api/v1/admin/categories/${category.body.data.id}`)
      .send({ isActive: false });

    const tree = await request(app).get("/api/v1/categories");
    expect(tree.body.data.map((c: { name: string }) => c.name)).not.toContain("Oculta");

    const bySlug = await request(app).get("/api/v1/categories/oculta");
    expect(bySlug.status).toBe(404);
  });

  it("paginación respeta page/limit", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent);

    const response = await request(app).get("/api/v1/products").query({ page: 1, limit: 1 });
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 1, total: 1 });
  });

  it("resuelve la badge del producto (texto + color) sin exponer su id", async () => {
    const { agent } = await createAdminSession(app);
    const { rootId } = await seedCatalog(agent);
    const badge = await agent.post("/api/v1/admin/badges").send({ text: "Nuevo", color: "success" });

    const withBadge = await agent.post("/api/v1/admin/products").send({
      name: "Tónico Facial",
      description: "Tónico hidratante",
      categoryId: rootId,
      badgeId: badge.body.data.id,
      variants: [sampleVariant({ sku: "TON-100ML" })],
    });
    await agent.patch(`/api/v1/admin/products/${withBadge.body.data.id}`).send({ status: "active" });

    const response = await request(app).get("/api/v1/products/tonico-facial");
    expect(response.status).toBe(200);
    expect(response.body.data.badge).toEqual({ text: "Nuevo", color: "success" });
  });

  it("un producto sin badge no trae la clave badge", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent);

    const response = await request(app).get("/api/v1/products/serum-de-vitamina-c");
    expect(response.status).toBe(200);
    expect(response.body.data.badge).toBeUndefined();
  });
});
