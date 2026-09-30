import { beforeEach, describe, expect, it, vi } from "vitest";
import { pngBuffer } from "../helpers/image-fixtures.js";

const uploadMock = vi.fn();
const destroyMock = vi.fn();
const resolveMediaProviderMock = vi.fn();

vi.mock("../../src/services/media-provider.js", () => ({
  resolveMediaProvider: (...args: unknown[]) => resolveMediaProviderMock(...args),
}));

const { buildApp } = await import("../../src/app.js");
const { SubscriptionPlan } = await import("../../src/models/subscription-plan.model.js");
const { createAdminSession } = await import("../helpers/admin-session.js");

const app = buildApp();

let planCounter = 0;

async function seedPlan(extra: Record<string, unknown> = {}) {
  planCounter += 1;
  return SubscriptionPlan.create({
    name: `Plan Fotos ${planCounter}`,
    slug: `plan-fotos-${planCounter}`,
    description: "Descripción del plan",
    priceCents: 49900,
    maxActiveSeats: 10,
    providerProductId: `prod_${planCounter}`,
    providerPriceId: `price_${planCounter}`,
    ...extra,
  });
}

function fakeImage(n: number) {
  return {
    url: `https://res.cloudinary.com/demo/image/upload/seed${n}.webp`,
    publicId: `esencia-glow/test/seed${n}`,
    width: 20,
    height: 20,
    format: "webp",
    bytes: 100,
  };
}

describe("routes/admin-subscription-plans — fotos y qué incluye (2.7c)", () => {
  beforeEach(() => {
    planCounter = 0;
    uploadMock.mockReset();
    destroyMock.mockReset();
    resolveMediaProviderMock.mockReset();
    resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
    let counter = 0;
    uploadMock.mockImplementation(async () => {
      counter += 1;
      return fakeImage(100 + counter);
    });
  });

  it("sube una imagen y la agrega al plan, en la carpeta subscription-plans", async () => {
    const { agent } = await createAdminSession(app);
    const plan = await seedPlan();

    const response = await agent
      .post(`/api/v1/admin/subscription-plans/${plan._id}/images`)
      .attach("images", await pngBuffer(), "caja.png");

    expect(response.status).toBe(201);
    expect(response.body.data.images).toHaveLength(1);
    expect(uploadMock).toHaveBeenCalledWith(expect.objectContaining({ folder: expect.stringContaining("subscription-plans") }));
  });

  it("rechaza con 400, sin subir nada, si el plan ya tiene 8 imágenes", async () => {
    const { agent } = await createAdminSession(app);
    const plan = await seedPlan({ images: Array.from({ length: 8 }, (_, i) => fakeImage(i)) });

    const response = await agent
      .post(`/api/v1/admin/subscription-plans/${plan._id}/images`)
      .attach("images", await pngBuffer(), "caja.png");

    expect(response.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("un plan inexistente responde 404", async () => {
    const { agent } = await createAdminSession(app);

    const response = await agent
      .post("/api/v1/admin/subscription-plans/64b7f0f0f0f0f0f0f0f0f0f0/images")
      .attach("images", await pngBuffer(), "caja.png");

    expect(response.status).toBe(404);
  });

  it("reordena las imágenes", async () => {
    const { agent } = await createAdminSession(app);
    const plan = await seedPlan({ images: [fakeImage(1), fakeImage(2)] });
    const [first, second] = plan.images.map((image) => image.id as string);

    const response = await agent
      .patch(`/api/v1/admin/subscription-plans/${plan._id}/images/order`)
      .send({ imageIds: [second, first] });

    expect(response.status).toBe(200);
    expect(response.body.data.images.map((image: { id: string }) => image.id)).toEqual([second, first]);
  });

  it("elimina una imagen y la destruye en el proveedor", async () => {
    const { agent } = await createAdminSession(app);
    const plan = await seedPlan({ images: [fakeImage(1)] });
    const imageId = plan.images[0]!.id as string;

    const response = await agent.delete(`/api/v1/admin/subscription-plans/${plan._id}/images/${imageId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.images).toHaveLength(0);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/seed1");
  });

  it("PATCH guarda los highlights recortados", async () => {
    const { agent } = await createAdminSession(app);
    const plan = await seedPlan();

    const response = await agent
      .patch(`/api/v1/admin/subscription-plans/${plan._id}`)
      .send({ highlights: ["  4 a 6 productos de tamaño completo  ", "Envío incluido"] });

    expect(response.status).toBe(200);
    expect(response.body.data.highlights).toEqual(["4 a 6 productos de tamaño completo", "Envío incluido"]);
  });

  it("PATCH rechaza más de 6 highlights y los de más de 120 caracteres", async () => {
    const { agent } = await createAdminSession(app);
    const plan = await seedPlan();

    const tooMany = await agent
      .patch(`/api/v1/admin/subscription-plans/${plan._id}`)
      .send({ highlights: Array.from({ length: 7 }, (_, i) => `Beneficio ${i}`) });
    const tooLong = await agent
      .patch(`/api/v1/admin/subscription-plans/${plan._id}`)
      .send({ highlights: ["x".repeat(121)] });

    expect(tooMany.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });

  it("el catálogo público expone las imágenes y los highlights, sin ids internos de Cloudinary", async () => {
    const { agent } = await createAdminSession(app);
    const plan = await seedPlan({
      images: [fakeImage(1)],
      highlights: ["Envío incluido"],
    });

    const response = await agent.get(`/api/v1/subscription-plans/${plan.slug}`);

    expect(response.status).toBe(200);
    expect(response.body.data.plan.highlights).toEqual(["Envío incluido"]);
    expect(response.body.data.plan.images).toHaveLength(1);
    expect(response.body.data.plan.images[0]).toMatchObject({ url: fakeImage(1).url, width: 20, height: 20 });
    expect(JSON.stringify(response.body)).not.toContain("esencia-glow/test/seed1");
  });
});
