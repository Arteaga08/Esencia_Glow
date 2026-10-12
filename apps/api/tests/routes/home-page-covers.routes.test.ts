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
const PATH = "/api/v1/admin/home/page-covers";

function mockMediaProvider() {
  uploadMock.mockReset();
  destroyMock.mockReset();
  resolveMediaProviderMock.mockReset();
  resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
  let counter = 0;
  uploadMock.mockImplementation(async () => {
    counter += 1;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/c${counter}.webp`,
      publicId: `secreto/c${counter}`,
      width: 1920,
      height: 640,
      format: "webp",
      bytes: 100,
    };
  });
}

describe("routes/admin-home — fotos de encabezado de Kits y Más vendidos", () => {
  beforeEach(mockMediaProvider);

  it("la primera foto crea la sección, sin exponer el publicId, y audita con la página", async () => {
    const { agent } = await createAdminSession(app);

    const uploaded = await agent
      .put(`${PATH}/kits/image`)
      .field("version", "0")
      .attach("image", await pngBuffer(), "kits.png");

    expect(uploaded.status).toBe(200);
    expect(uploaded.body.data.version).toBe(1);
    expect(uploaded.body.data.images.kits.url).toContain("c1.webp");
    expect(uploaded.body.data.images.kits.publicId).toBeUndefined();
    expect(uploaded.body.data.images.bestsellers).toBeUndefined();
    const entry = await AuditLog.findOne({ action: ContentAction.HOME_SECTION_UPDATED });
    expect(entry?.metadata).toMatchObject({ section: "pageCovers", version: 1, change: "image", slot: "kits" });

    const home = await agent.get("/api/v1/admin/home");
    expect(home.body.data.pageCovers.images.kits.url).toContain("c1.webp");
  });

  it("cada página guarda su foto por separado; reemplazar y borrar destruyen la anterior", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${PATH}/kits/image`).field("version", "0").attach("image", await pngBuffer(), "kits.png");

    const bestsellers = await agent
      .put(`${PATH}/bestsellers/image`)
      .field("version", "1")
      .attach("image", await pngBuffer(), "vendidos.png");
    expect(bestsellers.body.data.images.bestsellers.url).toContain("c2.webp");
    expect(bestsellers.body.data.images.kits.url).toContain("c1.webp");

    const replaced = await agent
      .put(`${PATH}/kits/image`)
      .field("version", "2")
      .attach("image", await pngBuffer(), "otra.png");
    expect(replaced.body.data.images.kits.url).toContain("c3.webp");
    expect(destroyMock).toHaveBeenCalledWith("secreto/c1");

    const removed = await agent.delete(`${PATH}/bestsellers/image?version=3`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.images.bestsellers).toBeUndefined();
    expect(removed.body.data.images.kits.url).toContain("c3.webp");
    expect(destroyMock).toHaveBeenCalledWith("secreto/c2");

    const missing = await agent.delete(`${PATH}/bestsellers/image?version=4`);
    expect(missing.status).toBe(404);
  });

  it("una página desconocida responde 400", async () => {
    const { agent } = await createAdminSession(app);

    const response = await agent
      .put(`${PATH}/novedades/image`)
      .field("version", "0")
      .attach("image", await pngBuffer(), "x.png");

    expect(response.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("una subida con versión vieja responde 409 sin subir nada al proveedor", async () => {
    const { agent } = await createAdminSession(app);
    await agent.put(`${PATH}/kits/image`).field("version", "0").attach("image", await pngBuffer(), "kits.png");
    uploadMock.mockClear();

    const stale = await agent
      .put(`${PATH}/bestsellers/image`)
      .field("version", "0")
      .attach("image", await pngBuffer(), "vendidos.png");

    expect(stale.status).toBe(409);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe("routes/home-public — fotos de encabezado de Kits y Más vendidos", () => {
  beforeEach(mockMediaProvider);

  it("cada foto se publica con solo existir, sin exponer publicId", async () => {
    const { agent } = await createAdminSession(app);

    const before = (await request(app).get("/api/v1/home")).body.data;
    expect(before.kitsPage).toBeUndefined();
    expect(before.bestsellersPage).toBeUndefined();

    await agent
      .put(`${PATH}/bestsellers/image`)
      .field("version", "0")
      .attach("image", await pngBuffer(), "vendidos.png");

    const after = (await request(app).get("/api/v1/home")).body.data;
    expect(after.bestsellersPage.image.url).toContain("c1.webp");
    expect(after.kitsPage).toBeUndefined();
    expect(JSON.stringify(after)).not.toContain("secreto");
  });
});
