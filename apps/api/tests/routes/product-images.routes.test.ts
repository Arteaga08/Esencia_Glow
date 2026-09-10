import { beforeEach, describe, expect, it, vi } from "vitest";
import { pngBuffer } from "../helpers/image-fixtures.js";

const uploadMock = vi.fn();
const destroyMock = vi.fn();
const resolveMediaProviderMock = vi.fn();

vi.mock("../../src/services/media-provider.js", () => ({
  resolveMediaProvider: (...args: unknown[]) => resolveMediaProviderMock(...args),
}));

const { buildApp } = await import("../../src/app.js");
const { Product } = await import("../../src/models/product.model.js");
const { createAdminSession } = await import("../helpers/admin-session.js");

const app = buildApp();

async function createProductWithCategory(agent: Awaited<ReturnType<typeof createAdminSession>>["agent"]) {
  const category = await agent.post("/api/v1/admin/categories").send({ name: "Skincare Coreano" });
  const categoryId = category.body.data.id as string;
  const product = await agent.post("/api/v1/admin/products").send({
    name: "Serum de Vitamina C",
    description: "Serum iluminador",
    categoryId,
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
  return product.body.data.id as string;
}

describe("routes/admin-product — imágenes", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    destroyMock.mockReset();
    resolveMediaProviderMock.mockReset();
    resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
    let counter = 0;
    uploadMock.mockImplementation(async () => {
      counter += 1;
      return {
        url: `https://res.cloudinary.com/demo/image/upload/x${counter}.webp`,
        publicId: `esencia-glow/test/x${counter}`,
        width: 20,
        height: 20,
        format: "webp",
        bytes: 100,
      };
    });
  });

  it("sube una imagen válida (PNG) y la agrega al producto", async () => {
    const { agent } = await createAdminSession(app);
    const productId = await createProductWithCategory(agent);
    const buffer = await pngBuffer();

    const response = await agent
      .post(`/api/v1/admin/products/${productId}/images`)
      .attach("images", buffer, "foto.png");

    expect(response.status).toBe(201);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(response.body.data.images).toHaveLength(1);
  });

  it("un buffer que no es una imagen real (aunque se llame .png) responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const productId = await createProductWithCategory(agent);
    const fakeImage = Buffer.from("esto no es una imagen, es texto plano");

    const response = await agent
      .post(`/api/v1/admin/products/${productId}/images`)
      .attach("images", fakeImage, "evil.png");

    expect(response.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("una imagen mayor a 5 MB responde 413", async () => {
    const { agent } = await createAdminSession(app);
    const productId = await createProductWithCategory(agent);
    const big = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(6 * 1024 * 1024),
    ]);

    const response = await agent
      .post(`/api/v1/admin/products/${productId}/images`)
      .attach("images", big, "grande.png");

    expect(response.status).toBe(413);
  });

  it("el campo alt se sanitiza (sanitizeMultipart corre después de multer)", async () => {
    const { agent } = await createAdminSession(app);
    const productId = await createProductWithCategory(agent);
    const buffer = await pngBuffer();

    const response = await agent
      .post(`/api/v1/admin/products/${productId}/images`)
      .field("alt", "<script>alert(1)</script>")
      .attach("images", buffer, "foto.png");

    expect(response.status).toBe(201);
    const alt = response.body.data.images[0].alt as string | undefined;
    expect(alt).not.toContain("<script>");
  });

  it("reordenar con un imageId desconocido responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const productId = await createProductWithCategory(agent);
    const buffer = await pngBuffer();
    await agent.post(`/api/v1/admin/products/${productId}/images`).attach("images", buffer, "foto.png");

    const response = await agent
      .patch(`/api/v1/admin/products/${productId}/images/order`)
      .send({ imageIds: ["507f1f77bcf86cd799439011"] });

    expect(response.status).toBe(400);
  });

  it("borrar una imagen llama a destroy con el publicId guardado", async () => {
    const { agent } = await createAdminSession(app);
    const productId = await createProductWithCategory(agent);
    const buffer = await pngBuffer();
    const upload = await agent
      .post(`/api/v1/admin/products/${productId}/images`)
      .attach("images", buffer, "foto.png");
    const imageId = upload.body.data.images[0].id as string;

    const response = await agent.delete(`/api/v1/admin/products/${productId}/images/${imageId}`);

    expect(response.status).toBe(200);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/x1");
  });

  it("si el save falla tras subir, se compensa borrando el asset recién subido", async () => {
    const { agent } = await createAdminSession(app);
    const productId = await createProductWithCategory(agent);
    const buffer = await pngBuffer();

    const saveSpy = vi
      .spyOn(Product.prototype, "save")
      .mockRejectedValueOnce(new Error("fallo simulado de guardado"));

    const response = await agent
      .post(`/api/v1/admin/products/${productId}/images`)
      .attach("images", buffer, "foto.png");

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/x1");
    saveSpy.mockRestore();
  });
});
