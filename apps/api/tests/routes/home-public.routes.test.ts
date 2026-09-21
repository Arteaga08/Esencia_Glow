import request from "supertest";
import { HomeBenefitIcon } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { HomeContent } from "../../src/models/home-content.model.js";
import { createAdminSession } from "../helpers/admin-session.js";

const app = buildApp();
const ADMIN = "/api/v1/admin/home";

type Agent = ReturnType<typeof request.agent>;

function variant(sku: string, overrides: Record<string, unknown> = {}) {
  return {
    sku,
    name: "30 ml",
    price: 34900,
    weightGrams: 150,
    dimensionsCm: { length: 5, width: 5, height: 10 },
    ...overrides,
  };
}

async function createProduct(
  agent: Agent,
  categoryId: string,
  name: string,
  sku: string,
  extra: Record<string, unknown> = {},
  activate = true,
) {
  const created = await agent
    .post("/api/v1/admin/products")
    .send({ name, description: "Desc", categoryId, variants: [variant(sku)], ...extra });
  if (activate) await agent.patch(`/api/v1/admin/products/${created.body.data.id}`).send({ status: "active" });
  return created.body.data.id as string;
}

describe("routes/home-public — GET /api/v1/home", () => {
  it("sin documento responde 200 con un objeto vacío y NO crea el singleton", async () => {
    const response = await request(app).get("/api/v1/home");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({});
    expect(await HomeContent.countDocuments()).toBe(0);
  });

  it("omite las secciones inactivas aunque tengan contenido (el documento conserva todo)", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${ADMIN}/announcement`).send({ version: 0, isActive: false, text: "Oculto" });
    await agent.put(`${ADMIN}/testimonials`).send({
      version: 0,
      isActive: true,
      items: [{ author: "Ana", quote: "Me encantó", isActive: true }],
    });

    const response = await request(app).get("/api/v1/home");

    expect(response.body.data.announcement).toBeUndefined();
    expect(response.body.data.testimonials.items).toHaveLength(1);
    // Fuente de verdad intacta: el admin sigue viendo lo inactivo.
    const admin = await agent.get(ADMIN);
    expect(admin.body.data.announcement.text).toBe("Oculto");
  });

  it("anuncio activo se sirve sin version/isActive/updatedAt", async () => {
    const { agent } = await createAdminSession(app);
    await agent
      .put(`${ADMIN}/announcement`)
      .send({ version: 0, isActive: true, text: "Envío gratis", href: "/tienda" });

    const { announcement } = (await request(app).get("/api/v1/home")).body.data;

    expect(announcement).toEqual({ text: "Envío gratis", href: "/tienda" });
  });

  it("testimonios y beneficios: omite ítems inactivos, respeta orden y no expone isActive", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${ADMIN}/testimonials`).send({
      version: 0,
      isActive: true,
      items: [
        { author: "Ana", quote: "Uno", isActive: true },
        { author: "Bea", quote: "Dos", isActive: false },
        { author: "Cami", quote: "Tres", isActive: true },
      ],
    });
    await agent.put(`${ADMIN}/benefits`).send({
      version: 0,
      isActive: true,
      items: [
        { icon: HomeBenefitIcon.LEAF, title: "Limpio", isActive: false },
        { icon: HomeBenefitIcon.HEART, title: "Cruelty free", body: "Sin pruebas", isActive: true },
      ],
    });

    const { testimonials, benefits } = (await request(app).get("/api/v1/home")).body.data;

    expect(testimonials.items.map((i: { author: string }) => i.author)).toEqual(["Ana", "Cami"]);
    expect(testimonials.items[0].isActive).toBeUndefined();
    expect(benefits.items).toHaveLength(1);
    expect(benefits.items[0]).toMatchObject({ icon: "heart", title: "Cruelty free", body: "Sin pruebas" });
  });

  it("una sección de ítems que queda vacía tras filtrar se omite", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${ADMIN}/testimonials`).send({
      version: 0,
      isActive: true,
      items: [{ author: "Ana", quote: "Uno", isActive: false }],
    });

    expect((await request(app).get("/api/v1/home")).body.data.testimonials).toBeUndefined();
  });

  it("hero: omite slides inactivos y slides sin imagen desktop; no expone publicId", async () => {
    const { agent } = await createAdminSession(app);
    const created = await agent.put(`${ADMIN}/hero`).send({
      version: 0,
      isActive: true,
      slides: [
        { title: "Con imagen", isActive: true },
        { title: "Sin imagen", isActive: true },
        { title: "Inactivo", isActive: false },
      ],
    });
    const [withImage, , inactive] = created.body.data.slides as { id: string }[];
    // Las imágenes se siembran directo en DB: la subida ya tiene sus propios tests.
    const image = (n: string) => ({
      url: `https://res.cloudinary.com/demo/${n}.webp`,
      publicId: `secreto/${n}`,
      width: 1600,
      height: 900,
      format: "webp",
      bytes: 10,
    });
    await HomeContent.updateOne(
      { _id: "home" },
      {
        $set: {
          "hero.slides.$[a].images.desktop": image("a"),
          "hero.slides.$[a].images.mobile": image("am"),
          "hero.slides.$[b].images.desktop": image("b"),
        },
      },
      { arrayFilters: [{ "a._id": withImage!.id }, { "b._id": inactive!.id }] },
    );

    const { hero } = (await request(app).get("/api/v1/home")).body.data;

    expect(hero.slides).toHaveLength(1);
    expect(hero.slides[0].title).toBe("Con imagen");
    expect(hero.slides[0].images.desktop.url).toContain("/a.webp");
    expect(hero.slides[0].images.mobile.url).toContain("/am.webp");
    expect(JSON.stringify(hero)).not.toContain("secreto");
  });

  it("hero sin ningún slide publicable se omite", async () => {
    const { agent } = await createAdminSession(app);
    await agent
      .put(`${ADMIN}/hero`)
      .send({ version: 0, isActive: true, slides: [{ title: "Sin imagen", isActive: true }] });

    expect((await request(app).get("/api/v1/home")).body.data.hero).toBeUndefined();
  });

  it("productos destacados: filtra archivados/borrador/canal suscripción/borrados y respeta el orden guardado", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare" });
    const categoryId = category.body.data.id as string;

    const first = await createProduct(agent, categoryId, "Primero", "P-1");
    const second = await createProduct(agent, categoryId, "Segundo", "P-2");
    const archived = await createProduct(agent, categoryId, "Archivado", "P-3");
    const draft = await createProduct(agent, categoryId, "Borrador", "P-4", {}, false);
    const subscription = await createProduct(agent, categoryId, "De caja", "P-5", { channel: "subscription" });
    await agent.delete(`/api/v1/admin/products/${archived}`);

    await agent.put(`${ADMIN}/featured-products`).send({
      version: 0,
      isActive: true,
      title: "Favoritos",
      productIds: [second, archived, draft, subscription, first],
    });

    const { featuredProducts } = (await request(app).get("/api/v1/home")).body.data;

    expect(featuredProducts.title).toBe("Favoritos");
    expect(featuredProducts.products.map((p: { name: string }) => p.name)).toEqual(["Segundo", "Primero"]);
    // Forma PublicProduct completa: categoría ya resuelta, sin campos internos.
    expect(featuredProducts.products[0].category).toMatchObject({ name: "Skincare" });
    expect(featuredProducts.products[0].status).toBeUndefined();
  });

  it("productos destacados: si todos quedan filtrados, la sección se omite", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare" });
    const draft = await createProduct(agent, category.body.data.id, "Borrador", "P-1", {}, false);
    await agent
      .put(`${ADMIN}/featured-products`)
      .send({ version: 0, isActive: true, productIds: [draft] });

    expect((await request(app).get("/api/v1/home")).body.data.featuredProducts).toBeUndefined();
  });

  it("un producto destacado con la categoría borrada NO tumba el home: solo se omite esa sección", async () => {
    const { agent } = await createAdminSession(app);
    const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare" });
    const product = await createProduct(agent, category.body.data.id, "Huérfano", "P-1");
    await agent.put(`${ADMIN}/announcement`).send({ version: 0, isActive: true, text: "Hola" });
    await agent
      .put(`${ADMIN}/featured-products`)
      .send({ version: 0, isActive: true, productIds: [product] });
    // Dato inconsistente (p. ej. legado): la categoría desaparece por fuera del guard de borrado.
    await Category.deleteOne({ _id: category.body.data.id });

    const response = await request(app).get("/api/v1/home");

    expect(response.status).toBe(200);
    expect(response.body.data.announcement).toEqual({ text: "Hola" });
    expect(response.body.data.featuredProducts).toBeUndefined();
  });

  it("categorías destacadas: omite las inactivas y respeta el orden", async () => {
    const { agent } = await createAdminSession(app);
    const a = (await agent.post("/api/v1/admin/categories").send({ name: "Alfa" })).body.data.id as string;
    const b = (await agent.post("/api/v1/admin/categories").send({ name: "Beta" })).body.data.id as string;
    const c = (await agent.post("/api/v1/admin/categories").send({ name: "Gama" })).body.data.id as string;
    await agent.patch(`/api/v1/admin/categories/${b}`).send({ isActive: false });

    await agent
      .put(`${ADMIN}/featured-categories`)
      .send({ version: 0, isActive: true, categoryIds: [c, b, a] });

    const { featuredCategories } = (await request(app).get("/api/v1/home")).body.data;
    expect(featuredCategories.categories.map((x: { name: string }) => x.name)).toEqual(["Gama", "Alfa"]);
  });

  it("promo de suscripción activa se sirve con su texto y cta", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${ADMIN}/subscription-promo`).send({
      version: 0,
      isActive: true,
      title: "La caja del mes",
      body: "Curada",
      ctaLabel: "Suscríbete",
      ctaHref: "/suscripcion",
    });

    const { subscriptionPromo } = (await request(app).get("/api/v1/home")).body.data;

    expect(subscriptionPromo).toEqual({
      title: "La caja del mes",
      body: "Curada",
      ctaLabel: "Suscríbete",
      ctaHref: "/suscripcion",
    });
  });

  it("es público (sin cookie) y no crea el documento al leer", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${ADMIN}/announcement`).send({ version: 0, isActive: true, text: "Hola" });
    const before = await HomeContent.findById("home").lean();

    const response = await request(app).get("/api/v1/home");

    expect(response.status).toBe(200);
    expect(await HomeContent.findById("home").lean()).toEqual(before);
  });
});
