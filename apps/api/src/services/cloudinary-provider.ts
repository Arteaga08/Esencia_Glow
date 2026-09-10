import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { getCloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import type { MediaAsset, MediaProvider, MediaUploadInput } from "./media-provider.js";

/**
 * Único módulo del proyecto que importa el SDK de Cloudinary. `unique_filename`
 * + `overwrite: false` porque el nombre del archivo lo genera Cloudinary,
 * nunca el `originalname` del cliente (anti path-traversal, ya se descarta en
 * upload-image.ts, pero esto es la segunda barrera).
 */
function upload(input: MediaUploadInput): Promise<MediaAsset> {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    return Promise.reject(new AppError("El servicio de imágenes no está configurado", 503));
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinaryFolder}/${input.folder}`,
        resource_type: "image",
        format: "webp",
        unique_filename: true,
        overwrite: false,
      },
      (error: unknown, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          reject(new AppError("No se pudo subir la imagen", 502));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );
    Readable.from(input.buffer).pipe(stream);
  });
}

async function destroy(publicId: string): Promise<void> {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw new AppError("El servicio de imágenes no está configurado", 503);
  }
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}

function createCloudinaryProvider(): MediaProvider {
  return { upload, destroy };
}

export { createCloudinaryProvider };
