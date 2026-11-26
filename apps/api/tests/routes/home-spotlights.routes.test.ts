import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentAction } from "@esencia-glow/shared";
import { pngBuffer } from "../helpers/image-fixtures.js";
import { serveAppForFile } from "../helpers/serve-app.js";

const uploadMock = vi.fn();
const destroyMock = vi.fn();
const resolveMediaProviderMock = vi.fn();

vi.mock("../../src/services/media-provider.js", () => ({
  resolveMediaProvider: (...args: unknown[]) => resolveMediaProviderMock(...args),
}));

const { buildApp } = await import("../../src/app.js");
const { AuditLog } = await import("../../src/models/audit-log.model.js");
const { createAdminSession } = await import("../helpers/admin-session.js");

const app = await serveAppForFile(buildApp());
const BASE = "/api/v1/admin/home";

type Agent = Awaited<ReturnType<typeof createAdminSession>>["agent"];

function mockMediaProvider() {
  uploadMock.mockReset();
  destroyMock.mockReset();
  resolveMediaProviderMock.mockReset();
  resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
  let counter = 0;
  uploadMock.mockImplementation(async () => {
    counter += 1;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/s${counter}.webp`,
      publicId: `secreto/s${counter}`,
      width: 1200,
      height: 1500,
      format: "webp",
      bytes: 100,
    };
  });
}

async function saveSpotlight(agent: Agent, slug: string, isActive: boolean, title = "Título") {
  const saved = await agent
    .put(`${BASE}/spotlights/${slug}`)
    .send({ version: 0, isActive, title, subtitle: "Subtítulo" });
  return saved.body.data.version as number;
}

describe("routes/admin-home — spotlights (Novedades y Kits)", () => {
  beforeEach(mockMediaProvider);

  it("guarda título y subtítulo de cada bloque por separado y audita con su sección", async () => {
    const { agent } = await createAdminSession(app);

    const novelties = await agent
      .put(`${BASE}/spotlights/new-arrivals`)
      .send({ version: 0, isActive: true, title: "Novedades", subtitle: "Lo último" });
    const kits = await agent.put(`${BASE}/spotlights/kits`).send({ version: 0, isActive: true, title: "Kits" });

    expect(novelties.status).toBe(200);
    expect(novelties.body.data).toMatchObject({ version: 1, title: "Novedades", subtitle: "Lo último" });
    expect(kits.body.data).toMatchObject({ version: 1, title: "Kits" });
    expect(kits.body.data.subtitle).toBeUndefined();

    const entries = await AuditLog.find({ action: ContentAction.HOME_SECTION_UPDATED }).sort({ createdAt: 1 });
    expect(entries.map((entry) => entry.metadata?.section)).toEqual(["newArrivals", "kits"]);
  });

  it("un segmento desconocido responde 400, y un título vacío también", async () => {
    const { agent } = await createAdminSession(app);

    const unknown = await agent.put(`${BASE}/spotlights/otra`).send({ version: 0, isActive: true, title: "X" });
    const empty = await agent.put(`${BASE}/spotlights/kits`).send({ version: 0, isActive: true, title: "" });

    expect(unknown.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  it("una versión vieja responde 409", async () => {
    const { agent } = await createAdminSession(app);
    await saveSpotlight(agent, "kits", true);

    const stale = await agent.put(`${BASE}/spotlights/kits`).send({ version: 0, isActive: true, title: "Otro" });

    expect(stale.status).toBe(409);
  });

  it("sube, reemplaza y borra la foto de escritorio y la de móvil", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveSpotlight(agent, "kits", true);

    const desktop = await agent
      .put(`${BASE}/spotlights/kits/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "portada.png");
    expect(desktop.status).toBe(200);
    expect(desktop.body.data.version).toBe(2);
    expect(desktop.body.data.images.desktop.url).toContain("s1.webp");
    expect(desktop.body.data.images.desktop.publicId).toBeUndefined();

    const mobile = await agent
      .put(`${BASE}/spotlights/kits/images/mobile`)
      .field("version", "2")
      .attach("image", await pngBuffer(), "portada-m.png");
    expect(mobile.body.data.images.mobile.url).toContain("s2.webp");

    const replaced = await agent
      .put(`${BASE}/spotlights/kits/images/desktop`)
      .field("version", "3")
      .attach("image", await pngBuffer(), "otra.png");
    expect(replaced.body.data.images.desktop.url).toContain("s3.webp");
    expect(destroyMock).toHaveBeenCalledWith("secreto/s1");

    const removed = await agent.delete(`${BASE}/spotlights/kits/images/mobile?version=4`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.images.mobile).toBeUndefined();
    expect(removed.body.data.images.desktop).toBeDefined();
    expect(destroyMock).toHaveBeenCalledWith("secreto/s2");

    const missing = await agent.delete(`${BASE}/spotlights/kits/images/mobile?version=5`);
    expect(missing.status).toBe(404);
  });

  it("una subida con versión vieja responde 409 sin subir nada al proveedor", async () => {
    const { agent } = await createAdminSession(app);
    await saveSpotlight(agent, "new-arrivals", true, "Novedades");

    const stale = await agent
      .put(`${BASE}/spotlights/new-arrivals/images/desktop`)
      .field("version", "0")
      .attach("image", await pngBuffer(), "portada.png");

    expect(stale.status).toBe(409);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe("routes/home-public — spotlights", () => {
  beforeEach(mockMediaProvider);

  it("sin foto de escritorio el bloque no se publica; con ella sí, sin exponer publicId", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent, { products: 1, bundles: 0, newArrivals: true });
    const version = await saveSpotlight(agent, "new-arrivals", true);

    const before = await request(app).get("/api/v1/home");
    expect(before.body.data.newArrivals).toBeUndefined();

    await agent
      .put(`${BASE}/spotlights/new-arrivals/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "portada.png");

    const after = (await request(app).get("/api/v1/home")).body.data;
    expect(after.newArrivals).toMatchObject({ title: "Título", subtitle: "Subtítulo" });
    expect(after.newArrivals.images.desktop.url).toContain("s1.webp");
    expect(after.newArrivals.images.mobile).toBeUndefined();
    expect(JSON.stringify(after)).not.toContain("secreto");
    expect(after.kits).toBeUndefined();
  });

  it("un bloque inactivo no se publica aunque tenga foto", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveSpotlight(agent, "kits", false);
    await agent
      .put(`${BASE}/spotlights/kits/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "portada.png");

    const response = await request(app).get("/api/v1/home");

    expect(response.body.data.kits).toBeUndefined();
  });
});

interface Seeded {
  products: string[];
  bundles: string[];
}

/** Productos y paquetes publicados, del más viejo al más reciente. */
async function seedCatalog(agent: Agent, counts: { products: number; bundles: number; newArrivals?: boolean }): Promise<Seeded> {
  const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare" });
  const products: string[] = [];
  const variants: { productId: string; variantId: string }[] = [];
  for (let n = 1; n <= counts.products; n += 1) {
    const created = await agent.post("/api/v1/admin/products").send({
      name: `Producto ${n}`,
      description: "Desc",
      categoryId: category.body.data.id,
      isNewArrival: counts.newArrivals ?? false,
      variants: [{ sku: `PRD-${n}`, name: "30 ml", price: 34900, weightGrams: 150 }],
    });
    await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ status: "active" });
    products.push(created.body.data.id as string);
    variants.push({ productId: created.body.data.id, variantId: created.body.data.variants[0].id });
  }
  const bundles: string[] = [];
  for (let n = 1; n <= counts.bundles; n += 1) {
    const created = await agent.post("/api/v1/admin/bundles").send({
      name: `Kit ${n}`,
      description: "Set",
      price: 99900,
      items: [{ ...variants[0]!, quantity: 1 }],
    });
    await agent.patch(`/api/v1/admin/bundles/${created.body.data.id}`).send({ status: "active" });
    bundles.push(created.body.data.id as string);
  }
  return { products, bundles };
}

/** Guarda la sección con esas tarjetas y le sube la foto de escritorio para que se publique. */
async function publishSpotlight(agent: Agent, slug: string, itemIds: string[]) {
  const saved = await agent.put(`${BASE}/spotlights/${slug}`).send({ version: 0, isActive: true, title: "Título", itemIds });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  await agent
    .put(`${BASE}/spotlights/${slug}/images/desktop`)
    .field("version", String(saved.body.data.version))
    .attach("image", await pngBuffer(), "portada.png");
}

describe("routes/admin-home — tarjetas elegidas de Novedades y Kits", () => {
  beforeEach(mockMediaProvider);

  it("guarda los ids en orden, los devuelve en el admin y los resume en GET …/items", async () => {
    const { agent } = await createAdminSession(app);
    const { products, bundles } = await seedCatalog(agent, { products: 3, bundles: 2 });
    const chosen = [products[2]!, products[0]!];

    const saved = await agent.put(`${BASE}/spotlights/new-arrivals`).send({ version: 0, isActive: true, title: "Novedades", itemIds: chosen });
    const kits = await agent.put(`${BASE}/spotlights/kits`).send({ version: 0, isActive: true, title: "Kits", itemIds: [bundles[1]] });

    expect(saved.status).toBe(200);
    expect(saved.body.data.itemIds).toEqual(chosen);
    expect(kits.body.data.itemIds).toEqual([bundles[1]]);
    expect((await agent.get(BASE)).body.data.newArrivals.itemIds).toEqual(chosen);

    const items = await agent.get(`${BASE}/spotlights/new-arrivals/items`);
    expect(items.status).toBe(200);
    expect(items.body.data).toEqual([
      expect.objectContaining({ id: chosen[0], name: "Producto 3", isPublished: true }),
      expect.objectContaining({ id: chosen[1], name: "Producto 1", isPublished: true }),
    ]);
    const kitItems = await agent.get(`${BASE}/spotlights/kits/items`);
    expect(kitItems.body.data).toEqual([expect.objectContaining({ id: bundles[1], name: "Kit 2", isPublished: true })]);
  });

  it("sin itemIds la selección queda vacía (el PUT describe la sección completa)", async () => {
    const { agent } = await createAdminSession(app);
    const { products } = await seedCatalog(agent, { products: 1, bundles: 0 });
    await agent.put(`${BASE}/spotlights/new-arrivals`).send({ version: 0, isActive: true, title: "N", itemIds: products });

    const cleared = await agent.put(`${BASE}/spotlights/new-arrivals`).send({ version: 1, isActive: true, title: "N" });

    expect(cleared.body.data.itemIds).toEqual([]);
  });

  it("marca como no publicado un producto en borrador", async () => {
    const { agent } = await createAdminSession(app);
    const { products } = await seedCatalog(agent, { products: 2, bundles: 0 });
    await agent.patch(`/api/v1/admin/products/${products[1]}`).send({ status: "draft" });
    await agent.put(`${BASE}/spotlights/new-arrivals`).send({ version: 0, isActive: true, title: "N", itemIds: products });

    const items = await agent.get(`${BASE}/spotlights/new-arrivals/items`);

    expect(items.body.data.map((item: { isPublished: boolean }) => item.isPublished)).toEqual([true, false]);
  });

  it("rechaza más de cuatro, repetidos, ids inválidos y ids que no existen", async () => {
    const { agent } = await createAdminSession(app);
    const { products, bundles } = await seedCatalog(agent, { products: 5, bundles: 1 });
    const put = (slug: string, itemIds: unknown) =>
      agent.put(`${BASE}/spotlights/${slug}`).send({ version: 0, isActive: true, title: "T", itemIds });

    expect((await put("new-arrivals", products)).status).toBe(400);
    expect((await put("new-arrivals", [products[0], products[0]])).status).toBe(400);
    expect((await put("new-arrivals", ["no-es-un-id"])).status).toBe(400);
    expect((await put("new-arrivals", ["64b7f0f0f0f0f0f0f0f0f0f0"])).status).toBe(400);
    // Un paquete no es un producto, ni al revés.
    expect((await put("new-arrivals", [bundles[0]])).status).toBe(400);
    expect((await put("kits", [products[0]])).status).toBe(400);
  });
});

describe("routes/home-public — tarjetas de Novedades y Kits", () => {
  beforeEach(mockMediaProvider);

  it("sirve las tarjetas elegidas en el orden guardado y omite las que ya no se publican", async () => {
    const { agent } = await createAdminSession(app);
    const { products, bundles } = await seedCatalog(agent, { products: 3, bundles: 3 });
    await agent.patch(`/api/v1/admin/products/${products[1]}`).send({ status: "draft" });
    await agent.patch(`/api/v1/admin/bundles/${bundles[0]}`).send({ status: "archived" });
    await publishSpotlight(agent, "new-arrivals", [products[2]!, products[1]!, products[0]!]);
    await publishSpotlight(agent, "kits", [bundles[2]!, bundles[0]!, bundles[1]!]);

    const home = (await request(app).get("/api/v1/home")).body.data;

    expect(home.newArrivals.products.map((p: { name: string }) => p.name)).toEqual(["Producto 3", "Producto 1"]);
    expect(home.kits.bundles.map((b: { name: string }) => b.name)).toEqual(["Kit 3", "Kit 2"]);
  });

  it("sin selección muestra automáticamente los más recientes (4 novedades marcadas, 4 kits)", async () => {
    const { agent } = await createAdminSession(app);
    await seedCatalog(agent, { products: 5, bundles: 5, newArrivals: true });
    await publishSpotlight(agent, "new-arrivals", []);
    await publishSpotlight(agent, "kits", []);

    const home = (await request(app).get("/api/v1/home")).body.data;

    expect(home.newArrivals.products.map((p: { name: string }) => p.name)).toEqual([
      "Producto 5",
      "Producto 4",
      "Producto 3",
      "Producto 2",
    ]);
    expect(home.kits.bundles.map((b: { name: string }) => b.name)).toEqual(["Kit 5", "Kit 4", "Kit 3", "Kit 2"]);
  });

  it("si nada de lo elegido sigue publicado, cae al automático en vez de dejar el bloque vacío", async () => {
    const { agent } = await createAdminSession(app);
    const { products } = await seedCatalog(agent, { products: 2, bundles: 0, newArrivals: true });
    await agent.patch(`/api/v1/admin/products/${products[0]}`).send({ isNewArrival: false });
    await publishSpotlight(agent, "new-arrivals", [products[0]!]);
    await agent.patch(`/api/v1/admin/products/${products[0]}`).send({ status: "draft" });

    const home = (await request(app).get("/api/v1/home")).body.data;

    expect(home.newArrivals.products.map((p: { name: string }) => p.name)).toEqual(["Producto 2"]);
  });

  it("sin ninguna tarjeta posible el bloque no se publica", async () => {
    const { agent } = await createAdminSession(app);
    await publishSpotlight(agent, "kits", []);

    const home = (await request(app).get("/api/v1/home")).body.data;

    expect(home.kits).toBeUndefined();
  });
});
