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

  describe("filtro por marca y facetas", () => {
    async function createActiveProduct(
      agent: ReturnType<typeof request.agent>,
      categoryId: string,
      input: { name: string; sku: string; brand?: string; price?: number; channel?: string; isActive?: boolean },
    ) {
      const created = await agent.post("/api/v1/admin/products").send({
        name: input.name,
        description: "Producto de prueba",
        categoryId,
        ...(input.brand ? { brand: input.brand } : {}),
        ...(input.channel ? { channel: input.channel } : {}),
        variants: [sampleVariant({ sku: input.sku, price: input.price ?? 10000 })],
      });
      await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ status: "active" });
      return created.body.data.id as string;
    }

    async function seedBrands(agent: ReturnType<typeof request.agent>) {
      const { rootId } = await seedCatalog(agent);
      const other = await agent.post("/api/v1/admin/categories").send({ name: "Cuerpo" });
      await createActiveProduct(agent, rootId, { name: "Gel Cosrx", sku: "COS-1", brand: "Cosrx", price: 20000 });
      await createActiveProduct(agent, rootId, { name: "Crema Cosrx", sku: "COS-2", brand: "Cosrx", price: 45000 });
      await createActiveProduct(agent, rootId, { name: "Tónico Isntree", sku: "ISN-1", brand: "Isntree", price: 30000 });
      await createActiveProduct(agent, other.body.data.id, { name: "Loción Beauty of Joseon", sku: "BOJ-1", brand: "Beauty of Joseon" });
      return { rootId };
    }

    it("brand filtra por una marca exacta", async () => {
      const { agent } = await createAdminSession(app);
      await seedBrands(agent);

      const response = await request(app).get("/api/v1/products").query({ brand: "Cosrx" });
      expect(response.status).toBe(200);
      expect(response.body.data.map((p: { name: string }) => p.name).sort()).toEqual(["Crema Cosrx", "Gel Cosrx"]);
    });

    it("brand acepta varias marcas separadas por coma", async () => {
      const { agent } = await createAdminSession(app);
      await seedBrands(agent);

      const response = await request(app).get("/api/v1/products").query({ brand: "Cosrx,Isntree" });
      expect(response.body.data).toHaveLength(3);
    });

    it("brand se combina con categoría y rango de precio", async () => {
      const { agent } = await createAdminSession(app);
      await seedBrands(agent);

      const response = await request(app)
        .get("/api/v1/products")
        .query({ category: "skincare-coreano", brand: "Cosrx", minPrice: 30000 });
      expect(response.body.data.map((p: { name: string }) => p.name)).toEqual(["Crema Cosrx"]);
    });

    it("una marca inexistente devuelve lista vacía, no error", async () => {
      const { agent } = await createAdminSession(app);
      await seedBrands(agent);

      const response = await request(app).get("/api/v1/products").query({ brand: "Marca Fantasma" });
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it("más de 10 marcas responde 400", async () => {
      const brands = Array.from({ length: 11 }, (_, index) => `Marca ${index}`).join(",");
      const response = await request(app).get("/api/v1/products").query({ brand: brands });
      expect(response.status).toBe(400);
    });

    it("un operador Mongo en brand no se interpreta", async () => {
      const { agent } = await createAdminSession(app);
      await seedBrands(agent);

      // Si `$in` se interpretara, solo saldrían los 2 productos Cosrx. La
      // defensa correcta es que el operador no filtre nada (o que dé 400).
      const response = await request(app).get("/api/v1/products?brand[$in]=Cosrx");
      expect(response.status).toBeLessThan(500);
      if (response.status === 200) expect(response.body.data).toHaveLength(5);
    });

    it("facets devuelve marcas ordenadas y rango de precio de la categoría, sin duplicar", async () => {
      const { agent } = await createAdminSession(app);
      await seedBrands(agent);

      const response = await request(app).get("/api/v1/products/facets").query({ category: "skincare-coreano" });
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ brands: ["Cosrx", "Isntree"], minPrice: 20000, maxPrice: 45000 });
    });

    it("facets sin categoría cubre todo el catálogo público", async () => {
      const { agent } = await createAdminSession(app);
      await seedBrands(agent);

      const response = await request(app).get("/api/v1/products/facets");
      expect(response.body.data.brands).toEqual(["Beauty of Joseon", "Cosrx", "Isntree"]);
    });

    it("facets deja fuera borradores, canal suscripción y variantes inactivas", async () => {
      const { agent } = await createAdminSession(app);
      const { rootId } = await seedBrands(agent);
      await createActiveProduct(agent, rootId, { name: "Solo Suscripción", sku: "SUB-1", brand: "Marca Suscripción", channel: "subscription" });
      await agent.post("/api/v1/admin/products").send({
        name: "Borrador Marca",
        description: "Sin publicar",
        categoryId: rootId,
        brand: "Marca Borrador",
        variants: [sampleVariant({ sku: "DRF-9" })],
      });

      const response = await request(app).get("/api/v1/products/facets").query({ category: "skincare-coreano" });
      expect(response.body.data.brands).toEqual(["Cosrx", "Isntree"]);
    });

    it("facets con una categoría desconocida responde vacío, no 404", async () => {
      const response = await request(app).get("/api/v1/products/facets").query({ category: "no-existe" });
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ brands: [], minPrice: null, maxPrice: null });
    });

    it("facets no choca con la ruta /:slug", async () => {
      const response = await request(app).get("/api/v1/products/facets");
      expect(response.status).toBe(200);
    });
  });

  describe("búsqueda por nombre, marca o categoría", () => {
    async function createActiveProduct(
      agent: ReturnType<typeof request.agent>,
      categoryId: string,
      input: { name: string; sku: string; brand?: string },
    ) {
      const created = await agent.post("/api/v1/admin/products").send({
        name: input.name,
        description: "Producto de prueba",
        categoryId,
        ...(input.brand ? { brand: input.brand } : {}),
        variants: [sampleVariant({ sku: input.sku })],
      });
      await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ status: "active" });
    }

    async function seedSearch(agent: ReturnType<typeof request.agent>) {
      const root = await agent.post("/api/v1/admin/categories").send({ name: "Cuidado Facial" });
      const rootId = root.body.data.id as string;
      const child = await agent.post("/api/v1/admin/categories").send({ name: "Limpiadores", parentId: rootId });
      const body = await agent.post("/api/v1/admin/categories").send({ name: "Cuerpo" });
      await createActiveProduct(agent, rootId, { name: "Sérum de Niacinamida", sku: "SR-1", brand: "Cosrx" });
      await createActiveProduct(agent, child.body.data.id, { name: "Espuma Suave", sku: "SR-2", brand: "Isntree" });
      await createActiveProduct(agent, body.body.data.id, { name: "Loción Hidratante", sku: "SR-3", brand: "Beauty of Joseon" });
    }

    async function search(term: string): Promise<string[]> {
      const response = await request(app).get("/api/v1/products").query({ search: term });
      expect(response.status).toBe(200);
      return response.body.data.map((p: { name: string }) => p.name).sort();
    }

    it("encuentra por nombre sin importar mayúsculas ni acentos", async () => {
      const { agent } = await createAdminSession(app);
      await seedSearch(agent);

      expect(await search("serum")).toEqual(["Sérum de Niacinamida"]);
      expect(await search("LOCION")).toEqual(["Loción Hidratante"]);
      expect(await search("sérum")).toEqual(["Sérum de Niacinamida"]);
    });

    it("encuentra por marca", async () => {
      const { agent } = await createAdminSession(app);
      await seedSearch(agent);

      expect(await search("cosrx")).toEqual(["Sérum de Niacinamida"]);
      expect(await search("joseon")).toEqual(["Loción Hidratante"]);
    });

    it("encuentra por categoría, incluidas sus subcategorías", async () => {
      const { agent } = await createAdminSession(app);
      await seedSearch(agent);

      expect(await search("facial")).toEqual(["Espuma Suave", "Sérum de Niacinamida"]);
      expect(await search("limpiadores")).toEqual(["Espuma Suave"]);
    });

    it("no busca por SKU y trata los símbolos como texto", async () => {
      const { agent } = await createAdminSession(app);
      await seedSearch(agent);

      expect(await search("SR-1")).toEqual([]);
      expect(await search(".*")).toEqual([]);
    });

    it("nunca devuelve borradores aunque coincidan", async () => {
      const { agent } = await createAdminSession(app);
      await seedCatalog(agent);

      expect(await search("borrador")).toEqual([]);
      expect(await search("skincare")).toEqual(["Serum de Vitamina C"]);
    });
  });

  describe("GET /:slug/availability", () => {
    it("responde isAvailable: true cuando hay stock disponible, sin exponer onHand/reserved", async () => {
      const { agent } = await createAdminSession(app);
      await seedCatalog(agent);
      const product = await request(app).get("/api/v1/products/serum-de-vitamina-c");
      const variantId = product.body.data.variants[0].id as string;
      await Inventory.create({
        productId: product.body.data.id,
        variantId,
        sku: product.body.data.variants[0].sku,
        onHand: 10,
        reserved: 3,
      });

      const response = await request(app).get("/api/v1/products/serum-de-vitamina-c/availability");

      expect(response.status).toBe(200);
      const line = response.body.data.find((l: { variantId: string }) => l.variantId === variantId);
      expect(line).toMatchObject({ isAvailable: true });
      expect(JSON.stringify(response.body.data)).not.toMatch(/onHand|reserved/);
    });

    it("responde isAvailable: false para una variante sin fila de inventario", async () => {
      const { agent } = await createAdminSession(app);
      await seedCatalog(agent);

      const response = await request(app).get("/api/v1/products/serum-de-vitamina-c/availability");

      expect(response.status).toBe(200);
      expect(response.body.data[0]).toMatchObject({ isAvailable: false });
    });

    it("un producto en borrador responde 404", async () => {
      const { agent } = await createAdminSession(app);
      await seedCatalog(agent);

      const response = await request(app).get("/api/v1/products/crema-en-borrador/availability");
      expect(response.status).toBe(404);
    });
  });
});
