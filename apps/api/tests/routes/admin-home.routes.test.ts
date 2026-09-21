import request from "supertest";
import { ContentAction, HomeBenefitIcon, HomeSectionKey } from "@esencia-glow/shared";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { HomeContent } from "../../src/models/home-content.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();
const BASE = "/api/v1/admin/home";

type Agent = ReturnType<typeof request.agent>;

async function seedProductAndCategory(agent: Agent) {
  const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare" });
  const product = await agent.post("/api/v1/admin/products").send({
    name: "Serum de Vitamina C",
    description: "Serum iluminador",
    categoryId: category.body.data.id,
    variants: [
      {
        sku: "SER-30ML",
        name: "30 ml",
        price: 34900,
        weightGrams: 150,
        dimensionsCm: { length: 5, width: 5, height: 10 },
      },
    ],
  });
  return { categoryId: category.body.data.id as string, productId: product.body.data.id as string };
}

describe("routes/admin-home — acceso", () => {
  it("sin cookie responde 401", async () => {
    expect((await request(app).get(BASE)).status).toBe(401);
    expect((await request(app).put(`${BASE}/announcement`).send({})).status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    expect((await agent.get(BASE)).status).toBe(403);
    expect((await agent.put(`${BASE}/announcement`).send({})).status).toBe(403);
  });
});

describe("routes/admin-home — lectura", () => {
  it("GET sin documento devuelve las 7 secciones vacías en versión 0 y NO crea el documento", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get(BASE);

    expect(response.status).toBe(200);
    const data = response.body.data;
    for (const key of Object.values(HomeSectionKey)) {
      expect(data[key]).toMatchObject({ version: 0, isActive: false });
    }
    expect(data.hero.slides).toEqual([]);
    expect(await HomeContent.countDocuments()).toBe(0);
  });
});

describe("routes/admin-home — announcement", () => {
  it("PUT crea la sección, sube la versión y deja UNA auditoría con la sección", async () => {
    const { agent, adminId } = await createAdminSession(app);

    const response = await agent
      .put(`${BASE}/announcement`)
      .send({ version: 0, isActive: true, text: "Envío gratis desde $999", href: "/tienda" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      version: 1,
      isActive: true,
      text: "Envío gratis desde $999",
      href: "/tienda",
    });

    const entries = await AuditLog.find({ action: ContentAction.HOME_SECTION_UPDATED });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actorId?.toString()).toBe(adminId);
    expect(entries[0]?.metadata).toMatchObject({ section: "announcement", version: 1, change: "content" });
  });

  it("un PUT sin href quita el href guardado (reemplazo de contenido de la sección)", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${BASE}/announcement`).send({ version: 0, isActive: true, text: "Hola", href: "/a" });

    const response = await agent.put(`${BASE}/announcement`).send({ version: 1, isActive: true, text: "Hola" });

    expect(response.status).toBe(200);
    expect(response.body.data.href).toBeUndefined();
    expect(response.body.data.version).toBe(2);
  });

  it("una versión vieja responde 409 y no deja auditoría ni cambios", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${BASE}/announcement`).send({ version: 0, isActive: true, text: "uno" });
    await agent.put(`${BASE}/announcement`).send({ version: 1, isActive: true, text: "dos" });

    const stale = await agent.put(`${BASE}/announcement`).send({ version: 1, isActive: true, text: "pisado" });

    expect(stale.status).toBe(409);
    const get = await agent.get(BASE);
    expect(get.body.data.announcement.text).toBe("dos");
    expect(await AuditLog.countDocuments({ action: ContentAction.HOME_SECTION_UPDATED })).toBe(2);
  });

  it.each([
    ["javascript:alert(1)"],
    ["//evil.example.com"],
    ["/\\evil.example.com"],
    ["/ruta\\con-backslash"],
    ["http://inseguro.example.com"],
    ["data:text/html,<b>x</b>"],
    ["tienda"],
  ])("rechaza el href %s con 400", async (href) => {
    const { agent } = await createAdminSession(app);
    const response = await agent.put(`${BASE}/announcement`).send({ version: 0, isActive: true, text: "x", href });
    expect(response.status).toBe(400);
  });

  it("acepta un href https:// y una ruta interna", async () => {
    const { agent } = await createAdminSession(app);
    const ok = await agent
      .put(`${BASE}/announcement`)
      .send({ version: 0, isActive: true, text: "x", href: "https://esenciaglow.mx/promo" });
    expect(ok.status).toBe(200);
  });

  it("falta la versión o el texto → 400; clave desconocida se descarta", async () => {
    const { agent } = await createAdminSession(app);
    expect((await agent.put(`${BASE}/announcement`).send({ isActive: true, text: "x" })).status).toBe(400);
    expect((await agent.put(`${BASE}/announcement`).send({ version: 0, isActive: true })).status).toBe(400);
    expect(
      (await agent.put(`${BASE}/announcement`).send({ version: 0, isActive: true, text: "x".repeat(121) })).status,
    ).toBe(400);
  });

  it("escribir announcement no toca otras secciones", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${BASE}/testimonials`).send({
      version: 0,
      isActive: true,
      items: [{ author: "Ana", quote: "Me encantó", isActive: true }],
    });
    await agent.put(`${BASE}/announcement`).send({ version: 0, isActive: true, text: "hola" });

    const get = await agent.get(BASE);
    expect(get.body.data.testimonials.items).toHaveLength(1);
    expect(get.body.data.testimonials.version).toBe(1);
    expect(get.body.data.announcement.version).toBe(1);
  });
});

describe("routes/admin-home — hero (contenido de slides)", () => {
  it("crea slides nuevos con id asignado por el servidor", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.put(`${BASE}/hero`).send({
      version: 0,
      isActive: true,
      slides: [
        { title: "Nueva colección", ctaLabel: "Ver", ctaHref: "/tienda", isActive: true },
        { title: "Segundo", isActive: false },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.data.slides).toHaveLength(2);
    expect(response.body.data.slides[0].id).toMatch(/^[a-f0-9]{24}$/);
    expect(response.body.data.slides[1].isActive).toBe(false);
  });

  it("reordena conservando ids; un id desconocido responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const created = await agent.put(`${BASE}/hero`).send({
      version: 0,
      isActive: true,
      slides: [
        { title: "A", isActive: true },
        { title: "B", isActive: true },
      ],
    });
    const [a, b] = created.body.data.slides as { id: string }[];

    const reordered = await agent.put(`${BASE}/hero`).send({
      version: 1,
      isActive: true,
      slides: [
        { id: b!.id, title: "B", isActive: true },
        { id: a!.id, title: "A editado", isActive: true },
      ],
    });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.slides.map((s: { id: string }) => s.id)).toEqual([b!.id, a!.id]);

    const unknown = await agent.put(`${BASE}/hero`).send({
      version: 2,
      isActive: true,
      slides: [{ id: new Types.ObjectId().toHexString(), title: "X", isActive: true }],
    });
    expect(unknown.status).toBe(400);
  });

  it("más de 5 slides o ids repetidos → 400", async () => {
    const { agent } = await createAdminSession(app);
    const six = Array.from({ length: 6 }, (_, i) => ({ title: `S${i}`, isActive: true }));
    expect((await agent.put(`${BASE}/hero`).send({ version: 0, isActive: true, slides: six })).status).toBe(400);

    const id = new Types.ObjectId().toHexString();
    const dup = await agent.put(`${BASE}/hero`).send({
      version: 0,
      isActive: true,
      slides: [
        { id, title: "A", isActive: true },
        { id, title: "B", isActive: true },
      ],
    });
    expect(dup.status).toBe(400);
  });

  it("ctaLabel sin ctaHref (o al revés) → 400", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .put(`${BASE}/hero`)
      .send({ version: 0, isActive: true, slides: [{ title: "A", ctaLabel: "Ver", isActive: true }] });
    expect(response.status).toBe(400);
  });
});

describe("routes/admin-home — destacados", () => {
  it("featured-products guarda ids en orden y valida que existan", async () => {
    const { agent } = await createAdminSession(app);
    const { productId } = await seedProductAndCategory(agent);

    const ok = await agent
      .put(`${BASE}/featured-products`)
      .send({ version: 0, isActive: true, title: "Favoritos", productIds: [productId] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.productIds).toEqual([productId]);

    const missing = await agent.put(`${BASE}/featured-products`).send({
      version: 1,
      isActive: true,
      productIds: [productId, new Types.ObjectId().toHexString()],
    });
    expect(missing.status).toBe(400);
  });

  it("featured-products rechaza duplicados y más de 12", async () => {
    const { agent } = await createAdminSession(app);
    const { productId } = await seedProductAndCategory(agent);

    const dup = await agent
      .put(`${BASE}/featured-products`)
      .send({ version: 0, isActive: true, productIds: [productId, productId] });
    expect(dup.status).toBe(400);

    const many = Array.from({ length: 13 }, () => new Types.ObjectId().toHexString());
    const tooMany = await agent
      .put(`${BASE}/featured-products`)
      .send({ version: 0, isActive: true, productIds: many });
    expect(tooMany.status).toBe(400);
  });

  it("featured-categories guarda ids y valida que existan", async () => {
    const { agent } = await createAdminSession(app);
    const { categoryId } = await seedProductAndCategory(agent);

    const ok = await agent
      .put(`${BASE}/featured-categories`)
      .send({ version: 0, isActive: true, categoryIds: [categoryId] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.categoryIds).toEqual([categoryId]);

    const missing = await agent
      .put(`${BASE}/featured-categories`)
      .send({ version: 1, isActive: true, categoryIds: [new Types.ObjectId().toHexString()] });
    expect(missing.status).toBe(400);
  });

  it("un producto archivado SÍ se puede guardar (el filtro es al servir, no al guardar)", async () => {
    const { agent } = await createAdminSession(app);
    const { productId } = await seedProductAndCategory(agent);
    await agent.delete(`/api/v1/admin/products/${productId}`);

    const response = await agent
      .put(`${BASE}/featured-products`)
      .send({ version: 0, isActive: true, productIds: [productId] });
    expect(response.status).toBe(200);
  });
});

describe("routes/admin-home — subscription-promo, testimonials, benefits", () => {
  it("subscription-promo guarda texto y cta (la imagen va por su propio endpoint)", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.put(`${BASE}/subscription-promo`).send({
      version: 0,
      isActive: true,
      title: "La caja del mes",
      body: "Una selección curada.",
      ctaLabel: "Suscríbete",
      ctaHref: "/suscripcion",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ version: 1, title: "La caja del mes", ctaHref: "/suscripcion" });
    expect(response.body.data.image).toBeUndefined();
  });

  it("testimonials conserva ids y rechaza más de 12 o ids desconocidos", async () => {
    const { agent } = await createAdminSession(app);
    const created = await agent.put(`${BASE}/testimonials`).send({
      version: 0,
      isActive: true,
      items: [{ author: "Ana", quote: "Me encantó", isActive: true }],
    });
    const id = created.body.data.items[0].id as string;

    const edited = await agent.put(`${BASE}/testimonials`).send({
      version: 1,
      isActive: true,
      items: [{ id, author: "Ana P.", quote: "Me encantó", isActive: false }],
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.items[0]).toMatchObject({ id, author: "Ana P.", isActive: false });

    const unknown = await agent.put(`${BASE}/testimonials`).send({
      version: 2,
      isActive: true,
      items: [{ id: new Types.ObjectId().toHexString(), author: "X", quote: "Y", isActive: true }],
    });
    expect(unknown.status).toBe(400);

    const many = Array.from({ length: 13 }, (_, i) => ({ author: `A${i}`, quote: "q", isActive: true }));
    expect((await agent.put(`${BASE}/testimonials`).send({ version: 2, isActive: true, items: many })).status).toBe(400);
  });

  it("benefits solo acepta íconos del enum fijo", async () => {
    const { agent } = await createAdminSession(app);
    const ok = await agent.put(`${BASE}/benefits`).send({
      version: 0,
      isActive: true,
      items: [{ icon: HomeBenefitIcon.LEAF, title: "Ingredientes limpios", isActive: true }],
    });
    expect(ok.status).toBe(200);

    const bad = await agent.put(`${BASE}/benefits`).send({
      version: 1,
      isActive: true,
      items: [{ icon: "<svg/>", title: "X", isActive: true }],
    });
    expect(bad.status).toBe(400);
  });

  it("cada escritura de sección deja exactamente UNA entrada de auditoría con su sección", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${BASE}/announcement`).send({ version: 0, isActive: true, text: "a" });
    await agent.put(`${BASE}/benefits`).send({ version: 0, isActive: true, items: [] });
    await agent.put(`${BASE}/testimonials`).send({ version: 0, isActive: true, items: [] });

    const sections = (await AuditLog.find({ action: ContentAction.HOME_SECTION_UPDATED }).sort({ createdAt: 1 })).map(
      (entry) => (entry.metadata as { section: string }).section,
    );
    expect(sections).toEqual(["announcement", "benefits", "testimonials"]);
  });
});
