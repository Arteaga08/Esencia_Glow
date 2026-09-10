import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pngBuffer, jpegWithExifBuffer, notAnImageBuffer } from "../helpers/image-fixtures.js";

const resolveMediaProviderMock = vi.fn();

vi.mock("../../src/services/media-provider.js", () => ({
  resolveMediaProvider: (...args: unknown[]) => resolveMediaProviderMock(...args),
}));

const { uploadImage, destroyImage } = await import("../../src/services/upload.service.js");

describe("services/upload — magic bytes -> sharp -> provider", () => {
  const uploadMock = vi.fn();
  const destroyMock = vi.fn();

  beforeEach(() => {
    uploadMock.mockReset();
    destroyMock.mockReset();
    resolveMediaProviderMock.mockReset();
    resolveMediaProviderMock.mockReturnValue({ upload: uploadMock, destroy: destroyMock });
    uploadMock.mockResolvedValue({
      url: "https://res.cloudinary.com/demo/image/upload/x.webp",
      publicId: "esencia-glow/test/x",
      width: 20,
      height: 20,
      format: "webp",
      bytes: 123,
    });
  });

  it("responde 503 si el proveedor de imágenes no está configurado", async () => {
    resolveMediaProviderMock.mockReturnValue(undefined);
    const buffer = await pngBuffer();
    await expect(uploadImage({ buffer, folder: "products" })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rechaza un buffer que no es una imagen real (magic bytes)", async () => {
    await expect(
      uploadImage({ buffer: notAnImageBuffer(), folder: "products" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("un PNG válido se sube una sola vez al proveedor", async () => {
    const buffer = await pngBuffer();
    const result = await uploadImage({ buffer, folder: "products" });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock.mock.calls[0]![0]).toMatchObject({ folder: "products", contentType: "image/webp" });
    expect(result.publicId).toBe("esencia-glow/test/x");
  });

  it("el buffer entregado al proveedor es WEBP y no conserva el EXIF del original", async () => {
    const buffer = await jpegWithExifBuffer();
    await uploadImage({ buffer, folder: "products" });

    const sentBuffer = uploadMock.mock.calls[0]![0].buffer as Buffer;
    const metadata = await sharp(sentBuffer).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
  });

  it("destroyImage delega en el proveedor con el publicId dado", async () => {
    await destroyImage("esencia-glow/test/x");
    expect(destroyMock).toHaveBeenCalledWith("esencia-glow/test/x");
  });

  it("destroyImage responde 503 sin proveedor configurado", async () => {
    resolveMediaProviderMock.mockReturnValue(undefined);
    await expect(destroyImage("x")).rejects.toMatchObject({ statusCode: 503 });
  });
});
