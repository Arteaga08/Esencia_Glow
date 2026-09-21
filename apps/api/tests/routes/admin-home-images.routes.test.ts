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
const { HomeContent } = await import("../../src/models/home-content.model.js");
const { createAdminSession } = await import("../helpers/admin-session.js");

const app = buildApp();
const BASE = "/api/v1/admin/home";

type Agent = Awaited<ReturnType<typeof createAdminSession>>["agent"];

async function createHeroWithSlide(agent: Agent) {
  const created = await agent.put(`${BASE}/hero`).send({
    version: 0,
    isActive: true,
    slides: [{ title: "Colección", isActive: true }],
  });
  return { slideId: created.body.data.slides[0].id as string, version: created.body.data.version as number };
}

describe("routes/admin-home — imágenes", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    destroyMock.mockReset();
    resolveMediaProviderMock.mockReset();
    resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
    let counter = 0;
    uploadMock.mockImplementation(async () => {
      counter += 1;
      return {
        url: `https://res.cloudinary.com/demo/image/upload/h${counter}.webp`,
        publicId: `esencia-glow/test/h${counter}`,
        width: 1600,
        height: 900,
        format: "webp",
        bytes: 100,
      };
    });
  });

  it("sube la imagen desktop de un slide, sube la versión y audita como change:image", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);

    const response = await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version))
      .field("alt", "Modelo con sérum")
      .attach("image", await pngBuffer(), "hero.png");

    expect(response.status).toBe(200);
    expect(response.body.data.version).toBe(version + 1);
    const image = response.body.data.slides[0].images.desktop;
    expect(image).toMatchObject({ width: 1600, height: 900, alt: "Modelo con sérum" });
    expect(image.url).toContain("h1.webp");
    expect(image.publicId).toBeUndefined();

    const entries = await AuditLog.find({ action: ContentAction.HOME_SECTION_UPDATED }).sort({ createdAt: 1 });
    expect(entries.at(-1)?.metadata).toMatchObject({
      section: "hero",
      version: version + 1,
      change: "image",
      slot: "desktop",
    });
  });

  it("reemplazar una imagen borra la anterior en el proveedor (best-effort)", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);
    await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "a.png");

    await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version + 1))
      .attach("image", await pngBuffer(), "b.png");

    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/h1");
  });

  it("una versión vieja responde 409 SIN subir nada al proveedor", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);

    const response = await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version - 1))
      .attach("image", await pngBuffer(), "a.png");

    expect(response.status).toBe(409);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("un slide inexistente responde 404 SIN subir nada", async () => {
    const { agent } = await createAdminSession(app);
    const { version } = await createHeroWithSlide(agent);

    const response = await agent
      .put(`${BASE}/hero/slides/aaaaaaaaaaaaaaaaaaaaaaaa/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "a.png");

    expect(response.status).toBe(404);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("si el CAS pierde DESPUÉS de subir (carrera), destruye lo subido y responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);

    // Simula a otro admin editando la sección mientras esta subida está en vuelo.
    uploadMock.mockImplementationOnce(async () => {
      await HomeContent.updateOne({ _id: "home" }, { $inc: { "hero.version": 1 } });
      return {
        url: "https://res.cloudinary.com/demo/image/upload/race.webp",
        publicId: "esencia-glow/test/race",
        width: 10,
        height: 10,
        format: "webp",
        bytes: 1,
      };
    });

    const response = await agent
      .put(`${BASE}/hero/slides/${slideId}/images/mobile`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "a.png");

    expect(response.status).toBe(409);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/race");
  });

  it("slot inválido → 400; sin archivo → 400; sin versión → 400; archivo falso → 400", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);

    const badSlot = await agent
      .put(`${BASE}/hero/slides/${slideId}/images/tablet`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "a.png");
    expect(badSlot.status).toBe(400);

    const noFile = await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version));
    expect(noFile.status).toBe(400);

    const noVersion = await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .attach("image", await pngBuffer(), "a.png");
    expect(noVersion.status).toBe(400);

    const fake = await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version))
      .attach("image", Buffer.from("no soy una imagen"), { filename: "a.png", contentType: "image/png" });
    expect(fake.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("DELETE quita la imagen del slot, sube la versión y la destruye en el proveedor", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);
    await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "a.png");

    const response = await agent.delete(`${BASE}/hero/slides/${slideId}/images/desktop?version=${version + 1}`);

    expect(response.status).toBe(200);
    expect(response.body.data.slides[0].images.desktop).toBeUndefined();
    expect(response.body.data.version).toBe(version + 2);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/h1");
  });

  it("DELETE sin imagen en ese slot responde 404; con versión vieja responde 409", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);

    expect((await agent.delete(`${BASE}/hero/slides/${slideId}/images/desktop?version=${version}`)).status).toBe(404);
    expect((await agent.delete(`${BASE}/hero/slides/${slideId}/images/desktop?version=${version - 1}`)).status).toBe(
      409,
    );
  });

  it("editar el contenido del hero conserva las imágenes de los slides que permanecen", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);
    await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "a.png");

    const edited = await agent.put(`${BASE}/hero`).send({
      version: version + 1,
      isActive: true,
      slides: [{ id: slideId, title: "Título nuevo", isActive: true }],
    });

    expect(edited.status).toBe(200);
    expect(edited.body.data.slides[0].title).toBe("Título nuevo");
    expect(edited.body.data.slides[0].images.desktop.url).toContain("h1.webp");
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it("quitar un slide destruye sus imágenes en el proveedor DESPUÉS de persistir", async () => {
    const { agent } = await createAdminSession(app);
    const { slideId, version } = await createHeroWithSlide(agent);
    await agent
      .put(`${BASE}/hero/slides/${slideId}/images/desktop`)
      .field("version", String(version))
      .attach("image", await pngBuffer(), "a.png");
    await agent
      .put(`${BASE}/hero/slides/${slideId}/images/mobile`)
      .field("version", String(version + 1))
      .attach("image", await pngBuffer(), "b.png");

    const removed = await agent.put(`${BASE}/hero`).send({ version: version + 2, isActive: true, slides: [] });

    expect(removed.status).toBe(200);
    expect(removed.body.data.slides).toEqual([]);
    expect(destroyMock).toHaveBeenCalledTimes(2);
  });

  it("promo: sube, reemplaza (destruye la anterior) y quita la imagen", async () => {
    const { agent } = await createAdminSession(app);
    const promo = await agent
      .put(`${BASE}/subscription-promo`)
      .send({ version: 0, isActive: true, title: "Caja", body: "Texto" });

    const up = await agent
      .put(`${BASE}/subscription-promo/image`)
      .field("version", String(promo.body.data.version))
      .attach("image", await pngBuffer(), "promo.png");
    expect(up.status).toBe(200);
    expect(up.body.data.image.url).toContain("h1.webp");

    const replaced = await agent
      .put(`${BASE}/subscription-promo/image`)
      .field("version", String(up.body.data.version))
      .attach("image", await pngBuffer(), "promo2.png");
    expect(replaced.status).toBe(200);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/h1");

    const removed = await agent.delete(`${BASE}/subscription-promo/image?version=${replaced.body.data.version}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.image).toBeUndefined();
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/h2");
  });

  it("editar el texto de la promo conserva su imagen", async () => {
    const { agent } = await createAdminSession(app);
    const promo = await agent
      .put(`${BASE}/subscription-promo`)
      .send({ version: 0, isActive: true, title: "Caja", body: "Texto" });
    const up = await agent
      .put(`${BASE}/subscription-promo/image`)
      .field("version", String(promo.body.data.version))
      .attach("image", await pngBuffer(), "promo.png");

    const edited = await agent.put(`${BASE}/subscription-promo`).send({
      version: up.body.data.version,
      isActive: true,
      title: "Caja curada",
      body: "Texto",
    });

    expect(edited.status).toBe(200);
    expect(edited.body.data.image.url).toContain("h1.webp");
  });

  it("promo: subir imagen sin que la sección exista todavía responde 404", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .put(`${BASE}/subscription-promo/image`)
      .field("version", "0")
      .attach("image", await pngBuffer(), "promo.png");
    expect(response.status).toBe(404);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
