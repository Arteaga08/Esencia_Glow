import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { pngBuffer } from "../helpers/image-fixtures.js";

const uploadMock = vi.fn();
const destroyMock = vi.fn();
const resolveMediaProviderMock = vi.fn();

vi.mock("../../src/services/media-provider.js", () => ({
  resolveMediaProvider: (...args: unknown[]) => resolveMediaProviderMock(...args),
}));

const { buildApp } = await import("../../src/app.js");
const { Brand } = await import("../../src/models/brand.model.js");
const { createAdminSession, createCustomerSession } = await import("../helpers/admin-session.js");

const app = buildApp();

describe("routes/admin-brand — logo, showOnHome y slug", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    destroyMock.mockReset();
    resolveMediaProviderMock.mockReset();
    resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
    let counter = 0;
    uploadMock.mockImplementation(async () => {
      counter += 1;
      return {
        url: `https://res.cloudinary.com/demo/image/upload/logo${counter}.webp`,
        publicId: `esencia-glow/test/logo${counter}`,
        width: 200,
        height: 80,
        format: "webp",
        bytes: 100,
      };
    });
  });

  it("al crear asigna slug y showOnHome apagado por defecto", async () => {
    const { agent } = await createAdminSession(app);
    const created = await agent.post("/api/v1/admin/brands").send({ name: "Mizu Botánica" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: "Mizu Botánica", slug: "mizu-botanica", showOnHome: false });
    expect(created.body.data.logo).toBeUndefined();
  });

  it("dos nombres distintos con el mismo slug reciben un sufijo", async () => {
    const { agent } = await createAdminSession(app);
    const first = await agent.post("/api/v1/admin/brands").send({ name: "Yuzu & Co" });
    const second = await agent.post("/api/v1/admin/brands").send({ name: "Yuzu Co" });
    expect(first.body.data.slug).toBe("yuzu-co");
    expect(second.body.data.slug).toBe("yuzu-co-2");
  });

  it("renombrar no cambia el slug y showOnHome se puede prender y apagar", async () => {
    const { agent } = await createAdminSession(app);
    const created = await agent.post("/api/v1/admin/brands").send({ name: "Anua" });
    const id = created.body.data.id as string;

    const renamed = await agent.patch(`/api/v1/admin/brands/${id}`).send({ name: "Anua Korea", showOnHome: true });
    expect(renamed.body.data).toMatchObject({ name: "Anua Korea", slug: "anua", showOnHome: true });

    const off = await agent.patch(`/api/v1/admin/brands/${id}`).send({ showOnHome: false });
    expect(off.body.data.showOnHome).toBe(false);
  });

  it("una marca anterior al slug lo recibe al editarla", async () => {
    const { agent } = await createAdminSession(app);
    const legacy = await Brand.collection.insertOne({ name: "Hanbit", createdAt: new Date(), updatedAt: new Date() });
    const id = legacy.insertedId.toString();

    const edited = await agent.patch(`/api/v1/admin/brands/${id}`).send({ showOnHome: true });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ slug: "hanbit", showOnHome: true });
  });

  it("rechaza showOnHome que no es booleano", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.post("/api/v1/admin/brands").send({ name: "Bruma", showOnHome: "quizá" });
    expect(response.status).toBe(400);
  });

  it("sube el logo, lo reemplaza borrando el anterior y lo elimina", async () => {
    const { agent } = await createAdminSession(app);
    const id = (await agent.post("/api/v1/admin/brands").send({ name: "Sorelle" })).body.data.id as string;

    const first = await agent.put(`/api/v1/admin/brands/${id}/logo`).attach("image", await pngBuffer(), "logo.png");
    expect(first.status).toBe(200);
    expect(first.body.data.logo).toMatchObject({ url: expect.stringContaining("logo1"), alt: "Sorelle" });
    expect(uploadMock).toHaveBeenCalledWith(expect.objectContaining({ folder: "brands" }));

    const second = await agent.put(`/api/v1/admin/brands/${id}/logo`).attach("image", await pngBuffer(), "logo.png");
    expect(second.body.data.logo.url).toContain("logo2");
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/logo1");

    const removed = await agent.delete(`/api/v1/admin/brands/${id}/logo`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.logo).toBeUndefined();
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/logo2");

    expect((await agent.delete(`/api/v1/admin/brands/${id}/logo`)).status).toBe(404);
  });

  it("borrar la marca borra su logo en Cloudinary", async () => {
    const { agent } = await createAdminSession(app);
    const id = (await agent.post("/api/v1/admin/brands").send({ name: "Lumen Skin" })).body.data.id as string;
    await agent.put(`/api/v1/admin/brands/${id}/logo`).attach("image", await pngBuffer(), "logo.png");

    expect((await agent.delete(`/api/v1/admin/brands/${id}`)).status).toBe(200);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/logo1");
  });

  it("el logo exige sesión de admin", async () => {
    expect((await request(app).put("/api/v1/admin/brands/64b000000000000000000000/logo")).status).toBe(401);
    const { agent } = await createCustomerSession(app);
    expect((await agent.delete("/api/v1/admin/brands/64b000000000000000000000/logo")).status).toBe(403);
  });
});

describe("routes/brands — público", () => {
  it("lista solo las marcas con showOnHome y slug, en orden alfabético", async () => {
    const { agent } = await createAdminSession(app);
    const bruma = (await agent.post("/api/v1/admin/brands").send({ name: "Bruma", showOnHome: true })).body.data.id;
    await agent.post("/api/v1/admin/brands").send({ name: "Aurea Lab", showOnHome: true });
    await agent.post("/api/v1/admin/brands").send({ name: "Oculta" });
    await Brand.collection.insertOne({ name: "Sin slug", showOnHome: true, createdAt: new Date(), updatedAt: new Date() });
    await agent.put(`/api/v1/admin/brands/${bruma}/logo`).attach("image", await pngBuffer(), "logo.png");

    const response = await request(app).get("/api/v1/brands");
    expect(response.status).toBe(200);
    expect(response.body.data.map((brand: { name: string }) => brand.name)).toEqual(["Aurea Lab", "Bruma"]);
    expect(response.body.data[1].logo).toMatchObject({ width: 200, height: 80 });
    expect(response.body.data[0]).not.toHaveProperty("showOnHome");
  });

  it("devuelve una marca por slug aunque no salga en el home, y 404 si no existe", async () => {
    const { agent } = await createAdminSession(app);
    await agent.post("/api/v1/admin/brands").send({ name: "Oculta" });

    const found = await request(app).get("/api/v1/brands/oculta");
    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({ name: "Oculta", slug: "oculta" });
    expect((await request(app).get("/api/v1/brands/no-existe")).status).toBe(404);
  });
});
