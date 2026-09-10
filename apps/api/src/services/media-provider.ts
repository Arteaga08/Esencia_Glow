import { isCloudinaryConfigured } from "../config/cloudinary.js";
import { createCloudinaryProvider } from "./cloudinary-provider.js";

/**
 * Interfaz angosta que aísla al resto del código de qué proveedor de media se
 * usa. `resolveMediaProvider` es el único condicional de proveedor de todo el
 * proyecto: sumar otro (p. ej. S3) mañana es un `else if` aquí y un archivo
 * nuevo, sin tocar upload.service.ts ni los controllers.
 */
interface MediaUploadInput {
  buffer: Buffer;
  folder: string;
  contentType: string;
}

interface MediaAsset {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

interface MediaProvider {
  upload(input: MediaUploadInput): Promise<MediaAsset>;
  destroy(publicId: string): Promise<void>;
}

function resolveMediaProvider(): MediaProvider | undefined {
  if (!isCloudinaryConfigured()) return undefined;
  return createCloudinaryProvider();
}

export { resolveMediaProvider };
export type { MediaProvider, MediaUploadInput, MediaAsset };
