import { Bundle, type BundleDocument } from "../models/bundle.model.js";
import { uploadImage, destroyImage } from "./upload.service.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import type { MediaAsset } from "./media-provider.js";

const MAX_BUNDLE_IMAGES = 8;

function toImageSubdocument(asset: MediaAsset, alt?: string) {
  return {
    url: asset.url,
    publicId: asset.publicId,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    bytes: asset.bytes,
    ...(alt ? { alt } : {}),
  };
}

/** Best-effort: un fallo al borrar en Cloudinary no debe tumbar la respuesta al admin. */
async function destroyBestEffort(publicId: string): Promise<void> {
  try {
    await destroyImage(publicId);
  } catch (error) {
    logger.warn({ err: error, publicId }, "No se pudo borrar la imagen en Cloudinary (huérfana)");
  }
}

async function getBundleOrThrow(bundleId: string): Promise<BundleDocument> {
  const bundle = await Bundle.findById(bundleId);
  if (!bundle) throw new AppError("Paquete no encontrado", 404);
  return bundle;
}

async function addBundleImages(
  bundleId: string,
  buffers: Buffer[],
  alt?: string,
): Promise<BundleDocument> {
  const bundle = await getBundleOrThrow(bundleId);
  if (bundle.images.length + buffers.length > MAX_BUNDLE_IMAGES) {
    throw new AppError(`Un paquete admite máximo ${MAX_BUNDLE_IMAGES} imágenes`, 400);
  }

  const uploaded: MediaAsset[] = [];
  try {
    for (const buffer of buffers) {
      uploaded.push(await uploadImage({ buffer, folder: "bundles" }));
    }
    bundle.images.push(...uploaded.map((asset) => toImageSubdocument(asset, alt)));
    await bundle.save();
    return bundle;
  } catch (error) {
    await Promise.all(uploaded.map((asset) => destroyBestEffort(asset.publicId)));
    throw error;
  }
}

async function removeBundleImage(bundleId: string, imageId: string): Promise<BundleDocument> {
  const bundle = await getBundleOrThrow(bundleId);
  const image = bundle.images.id(imageId);
  if (!image) throw new AppError("Imagen no encontrada", 404);

  const publicId = image.publicId;
  image.deleteOne();
  await bundle.save();
  await destroyBestEffort(publicId);
  return bundle;
}

async function reorderBundleImages(bundleId: string, imageIds: string[]): Promise<BundleDocument> {
  const bundle = await getBundleOrThrow(bundleId);
  const byId = new Map(bundle.images.map((image) => [image.id as string, image]));

  if (imageIds.length !== bundle.images.length || !imageIds.every((id) => byId.has(id))) {
    throw new AppError("La lista de imágenes no coincide con las imágenes actuales", 400);
  }

  const reordered = imageIds.map((id) => byId.get(id)!);
  bundle.images.splice(0, bundle.images.length, ...reordered);
  await bundle.save();
  return bundle;
}

export { addBundleImages, removeBundleImage, reorderBundleImages };
