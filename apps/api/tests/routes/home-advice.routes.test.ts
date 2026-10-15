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
const PATH = "/api/v1/admin/home/advice";

type Agent = Awaited<ReturnType<typeof createAdminSession>>["agent"];

const VALID_BODY = {
  isActive: true,
  eyebrow: "Asesoría personalizada",
  title: "Tu rutina, armada contigo",
  body: "Cuéntanos cómo es tu piel y te decimos qué productos sí te sirven.",
  archWord: "Asesoría",
  ctaLabel: "Pedir asesoría",
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
      url: `https://res.cloudinary.com/demo/image/upload/a${counter}.webp`,
      publicId: `secreto/a${counter}`,
      width: 1080,
      height: 1440,
      format: "webp",
      bytes: 100,
    };
  });
}

async function saveAdvice(agent: Agent, overrides: Partial<typeof VALID_BODY> = {}) {
  const saved = await agent.put(PATH).send({ version: 0, ...VALID_BODY, ...overrides });
  return saved.body.data.version as number;
}

async function uploadPhoto(agent: Agent, version: number) {
  return agent
    .put(`${PATH}/image`)
    .field("version", String(version))
    .attach("image", await pngBuffer(), "asesoria.png");
}

describe("routes/admin-home — bloque de asesoría", () => {
  beforeEach(mockMediaProvider);

  it("guarda los textos y audita con su sección", async () => {
    const { agent } = await createAdminSession(app);

    const response = await agent.put(PATH).send({ version: 0, ...VALID_BODY });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ version: 1, ...VALID_BODY });
    expect(response.body.data.image).toBeUndefined();
    const entry = await AuditLog.findOne({ action: ContentAction.HOME_SECTION_UPDATED });
    expect(entry?.metadata).toMatchObject({ section: "advice", version: 1, change: "content" });

    const home = await agent.get("/api/v1/admin/home");
    expect(home.body.data.advice).toMatchObject({ version: 1, title: VALID_BODY.title });
  });

  it("la etiqueta y la palabra del arco son opcionales: ausentes se quitan", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveAdvice(agent);

    const response = await agent.put(PATH).send({ version, ...VALID_BODY, eyebrow: undefined, archWord: undefined });

    expect(response.status).toBe(200);
    expect(response.body.data.eyebrow).toBeUndefined();
    expect(response.body.data.archWord).toBeUndefined();
  });

  it("título, texto y botón son obligatorios y los topes se respetan", async () => {
    const { agent } = await createAdminSession(app);

    const noTitle = await agent.put(PATH).send({ version: 0, ...VALID_BODY, title: "" });
    const noBody = await agent.put(PATH).send({ version: 0, ...VALID_BODY, body: undefined });
    const noLabel = await agent.put(PATH).send({ version: 0, ...VALID_BODY, ctaLabel: "" });
    const longWord = await agent.put(PATH).send({ version: 0, ...VALID_BODY, archWord: "x".repeat(15) });

    expect([noTitle.status, noBody.status, noLabel.status, longWord.status]).toEqual([400, 400, 400, 400]);
  });

  it("un enlace enviado de más se descarta: el botón siempre abre el WhatsApp de asesoría", async () => {
    const { agent } = await createAdminSession(app);

    const response = await agent.put(PATH).send({ version: 0, ...VALID_BODY, ctaHref: "javascript:alert(1)" });

    expect(response.status).toBe(200);
    expect(response.body.data.ctaHref).toBeUndefined();
  });

  it("una versión vieja responde 409", async () => {
    const { agent } = await createAdminSession(app);
    await saveAdvice(agent);

    const stale = await agent.put(PATH).send({ version: 0, ...VALID_BODY });

    expect(stale.status).toBe(409);
  });

  it("sube, reemplaza y borra la foto sin exponer el publicId", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveAdvice(agent);

    const uploaded = await uploadPhoto(agent, version);
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.data.version).toBe(2);
    expect(uploaded.body.data.image.url).toContain("a1.webp");
    expect(uploaded.body.data.image.publicId).toBeUndefined();

    const replaced = await uploadPhoto(agent, 2);
    expect(replaced.body.data.image.url).toContain("a2.webp");
    expect(destroyMock).toHaveBeenCalledWith("secreto/a1");

    const removed = await agent.delete(`${PATH}/image?version=3`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.image).toBeUndefined();
    expect(destroyMock).toHaveBeenCalledWith("secreto/a2");

    const missing = await agent.delete(`${PATH}/image?version=4`);
    expect(missing.status).toBe(404);
  });

  it("la foto puede subirse antes que los textos", async () => {
    const { agent } = await createAdminSession(app);

    const uploaded = await uploadPhoto(agent, 0);

    expect(uploaded.status).toBe(200);
    expect(uploaded.body.data).toMatchObject({ version: 1, isActive: false, title: "" });
  });

  it("una subida con versión vieja responde 409 sin subir nada al proveedor", async () => {
    const { agent } = await createAdminSession(app);
    await saveAdvice(agent);

    const stale = await uploadPhoto(agent, 0);

    expect(stale.status).toBe(409);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe("routes/home-public — bloque de asesoría", () => {
  beforeEach(mockMediaProvider);

  it("sin foto no se publica; con ella sí, sin exponer publicId", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveAdvice(agent);

    const before = await request(app).get("/api/v1/home");
    expect(before.body.data.advice).toBeUndefined();

    await uploadPhoto(agent, version);

    const after = (await request(app).get("/api/v1/home")).body.data;
    expect(after.advice).toMatchObject(
      Object.fromEntries(Object.entries(VALID_BODY).filter(([key]) => key !== "isActive")),
    );
    expect(after.advice.image.url).toContain("a1.webp");
    expect(JSON.stringify(after)).not.toContain("secreto");
  });

  it("un bloque inactivo no se publica aunque tenga foto", async () => {
    const { agent } = await createAdminSession(app);
    const version = await saveAdvice(agent, { isActive: false });
    await uploadPhoto(agent, version);

    const response = await request(app).get("/api/v1/home");

    expect(response.body.data.advice).toBeUndefined();
  });
});
