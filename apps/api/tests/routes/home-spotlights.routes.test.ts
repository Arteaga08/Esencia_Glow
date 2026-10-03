import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentAction } from "@esencia-glow/shared";
import { pngBuffer } from "../helpers/image-fixtures.js";

const uploadMock = vi.fn();
const destroyMock = vi.fn();
const resolveMediaProviderMock = vi.fn();

vi.mock("../../src/services/media-provider.js", () => ({
  resolveMediaProvider: (...args: unknown[]) => resolveMediaProviderMock(...args),
}));

const { buildApp } = await import("../../src/app.js");
const { AuditLog } = await import("../../src/models/audit-log.model.js");
const { createAdminSession } = await import("../helpers/admin-session.js");

const app = buildApp();
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
