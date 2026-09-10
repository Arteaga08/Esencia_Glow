import sharp from "sharp";
import { detectImageMime } from "../utils/image-signature.js";
import { AppError } from "../utils/app-error.js";
import { resolveMediaProvider } from "./media-provider.js";
import type { MediaAsset } from "./media-provider.js";

const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 82;
// Techo de megapíxeles de entrada — corta un decompression bomb (una imagen
// que se anuncia pequeña en bytes pero decodifica a un lienzo gigantesco).
const MAX_INPUT_PIXELS = 40_000_000;

interface UploadImageInput {
  buffer: Buffer;
  folder: "products" | "categories" | "bundles";
}

/**
 * Pipeline único de procesamiento de imagen: magic bytes -> sharp -> proveedor.
 * El strip de EXIF es el comportamiento DEFAULT de sharp (no copia EXIF/ICC/
 * XMP salvo que se llame `.withMetadata()`, que nunca se llama aquí) —
 * `.rotate()` va primero porque, al perder el EXIF, se perdería con él la
 * orientación de la foto si no se aplica antes.
 */
async function uploadImage(input: UploadImageInput): Promise<MediaAsset> {
  const provider = resolveMediaProvider();
  if (!provider) {
    throw new AppError("El servicio de imágenes no está configurado", 503);
  }

  const mime = detectImageMime(input.buffer);
  if (!mime) {
    throw new AppError("Formato de imagen no soportado. Usa JPG, PNG o WEBP.", 400);
  }

  let pipeline;
  try {
    pipeline = sharp(input.buffer, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });
    await pipeline.metadata();
  } catch {
    throw new AppError("No se pudo procesar la imagen enviada", 400);
  }

  const processedBuffer = await pipeline
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return provider.upload({
    buffer: processedBuffer,
    folder: input.folder,
    contentType: "image/webp",
  });
}

async function destroyImage(publicId: string): Promise<void> {
  const provider = resolveMediaProvider();
  if (!provider) {
    throw new AppError("El servicio de imágenes no está configurado", 503);
  }
  await provider.destroy(publicId);
}

export { uploadImage, destroyImage };
export type { UploadImageInput };
