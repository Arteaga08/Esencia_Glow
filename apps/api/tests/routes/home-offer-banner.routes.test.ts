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
const PATH = "/api/v1/admin/home/offer-banner";

type Agent = Awaited<ReturnType<typeof createAdminSession>>["agent"];

const VALID_BODY = {
  isActive: true,
  text: "Brilla, hidrata, repite.",
  ctaLabel: "Lo quiero",
  ctaHref: "/producto/serum-glow",
};

function mockMediaProvider() {
  uploadMock.mockReset();
  destroyMock.mockReset();
  resolveMediaProviderMock.mockReset();
  resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
  let counter = 0;
  uploadMock.mockImplementation(async () => {
    counter += 1;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/o${counter}.webp`,
      publicId: `secreto/o${counter}`,
      width: 1920,
      height: 900,
      format: "webp",
      bytes: 100,
    };
  });
}

async function saveBanner(agent: Agent, overrides: Partial<typeof VALID_BODY> = {}) {
  const saved = await agent.put(PATH).send({ version: 0, ...VALID_BODY, ...overrides });
  return saved.body.data.version as number;
}

describe("routes/admin-home — banner de oferta", () => {
  beforeEach(mockMediaProvider);

  it("guarda frase, botón y enlace, y audita con su sección", async () => {
    const { agent } = await createAdminSession(app);

    const response = await agent.put(PATH).send({ version: 0, ...VALID_BODY });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ version: 1, ...VALID_BODY, images: {} });
    const entry = await AuditLog.findOne({ action: ContentAction.HOME_SECTION_UPDATED });
    expect(entry?.metadata).toMatchObject({ section: "offerBanner", version: 1, change: "content" });

    const home = await agent.get("/api/v1/admin/home");
    expect(home.body.data.offerBanner).toMatchObject({ version: 1, text: VALID_BODY.text });
  });

  it("la frase, el botón y el enlace son obligatorios; un enlace javascript: se rechaza", async () => {
    const { agent } = await createAdminSession(app);

    const noText = await agent.put(PATH).send({ version: 0, ...VALID_BODY, text: "" });
    const noLabel = await agent.put(PATH).send({ version: 0, ...VALID_BODY, ctaLabel: undefined });
    const badHref = await agent.put(PATH).send({ version: 0, ...VALID_BODY, ctaHref: "javascript:alert(1)" });
    const tooLong = await agent.put(PATH).send({ version: 0, ...VALID_BODY, text: "x".repeat(81) });

    expect([noText.status, noLabel.status, badHref.status, tooLong.status]).toEqual([400, 400, 400, 400]);
  });

  it("una versión vieja responde 409", async () => {
    const { agent } = await createAdminSession(app);
    await saveBanner(agent);

    const stale = await agent.put(PATH).send({ version: 0, ...VALID_BODY });

    expect(stale.status).toBe(409);
  });

  it("sube, reemplaza y borra las fotos sin exponer el publicId", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveBanner(agent);

    const desktop = await agent
      .put(`${PATH}/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "banner.png");
    expect(desktop.status).toBe(200);
    expect(desktop.body.data.version).toBe(2);
    expect(desktop.body.data.images.desktop.url).toContain("o1.webp");
    expect(desktop.body.data.images.desktop.publicId).toBeUndefined();

    const mobile = await agent
      .put(`${PATH}/images/mobile`)
      .field("version", "2")
      .attach("image", await pngBuffer(), "banner-m.png");
    expect(mobile.body.data.images.mobile.url).toContain("o2.webp");

    const replaced = await agent
      .put(`${PATH}/images/desktop`)
      .field("version", "3")
      .attach("image", await pngBuffer(), "otro.png");
    expect(replaced.body.data.images.desktop.url).toContain("o3.webp");
    expect(destroyMock).toHaveBeenCalledWith("secreto/o1");

    const removed = await agent.delete(`${PATH}/images/mobile?version=4`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.images.mobile).toBeUndefined();
    expect(destroyMock).toHaveBeenCalledWith("secreto/o2");

    const missing = await agent.delete(`${PATH}/images/mobile?version=5`);
    expect(missing.status).toBe(404);

    const badSlot = await agent.delete(`${PATH}/images/tablet?version=5`);
    expect(badSlot.status).toBe(400);
  });

  it("una subida con versión vieja responde 409 sin subir nada al proveedor", async () => {
    const { agent } = await createAdminSession(app);
    await saveBanner(agent);

    const stale = await agent
      .put(`${PATH}/images/desktop`)
      .field("version", "0")
      .attach("image", await pngBuffer(), "banner.png");

    expect(stale.status).toBe(409);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe("routes/home-public — banner de oferta", () => {
  beforeEach(mockMediaProvider);

  it("sin foto de escritorio no se publica; con ella sí, sin exponer publicId", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveBanner(agent);

    const before = await request(app).get("/api/v1/home");
    expect(before.body.data.offerBanner).toBeUndefined();

    await agent
      .put(`${PATH}/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "banner.png");

    const after = (await request(app).get("/api/v1/home")).body.data;
    expect(after.offerBanner).toMatchObject({
      text: VALID_BODY.text,
      ctaLabel: VALID_BODY.ctaLabel,
      ctaHref: VALID_BODY.ctaHref,
    });
    expect(after.offerBanner.images.desktop.url).toContain("o1.webp");
    expect(after.offerBanner.images.mobile).toBeUndefined();
    expect(JSON.stringify(after)).not.toContain("secreto");
  });

  it("un banner inactivo no se publica aunque tenga foto", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveBanner(agent, { isActive: false });
    await agent
      .put(`${PATH}/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "banner.png");

    const response = await request(app).get("/api/v1/home");

    expect(response.body.data.offerBanner).toBeUndefined();
  });
});
