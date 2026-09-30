import { MAX_PLAN_IMAGES } from "@esencia-glow/shared";
import type { SubscriptionPlanDocument } from "../models/subscription-plan.model.js";
import { uploadImage, destroyImage } from "./upload.service.js";
import { getPlanDocument } from "./subscription-plan.service.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import type { MediaAsset } from "./media-provider.js";

/**
 * Fotos del plan para el catálogo público de suscripción (Milestone 2.7c).
 * Mismo patrón que bundle-image.service.ts: el tope se valida ANTES de subir
 * nada, y si el guardado falla se destruyen en el proveedor las imágenes ya
 * subidas para no dejar huérfanas.
 */

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

async function addPlanImages(planId: string, buffers: Buffer[], alt?: string): Promise<SubscriptionPlanDocument> {
  const plan = await getPlanDocument(planId);
  if (plan.images.length + buffers.length > MAX_PLAN_IMAGES) {
    throw new AppError(`Un plan admite máximo ${MAX_PLAN_IMAGES} imágenes`, 400);
  }

  const uploaded: MediaAsset[] = [];
  try {
    for (const buffer of buffers) {
      uploaded.push(await uploadImage({ buffer, folder: "subscription-plans" }));
    }
    plan.images.push(...uploaded.map((asset) => toImageSubdocument(asset, alt)));
    await plan.save();
    return plan;
  } catch (error) {
    await Promise.all(uploaded.map((asset) => destroyBestEffort(asset.publicId)));
    throw error;
  }
}

async function removePlanImage(planId: string, imageId: string): Promise<SubscriptionPlanDocument> {
  const plan = await getPlanDocument(planId);
  const image = plan.images.id(imageId);
  if (!image) throw new AppError("Imagen no encontrada", 404);

  const publicId = image.publicId;
  image.deleteOne();
  await plan.save();
  await destroyBestEffort(publicId);
  return plan;
}

async function reorderPlanImages(planId: string, imageIds: string[]): Promise<SubscriptionPlanDocument> {
  const plan = await getPlanDocument(planId);
  const byId = new Map(plan.images.map((image) => [image.id as string, image]));

  if (imageIds.length !== plan.images.length || !imageIds.every((id) => byId.has(id))) {
    throw new AppError("La lista de imágenes no coincide con las imágenes actuales", 400);
  }

  const reordered = imageIds.map((id) => byId.get(id)!);
  plan.images.splice(0, plan.images.length, ...reordered);
  await plan.save();
  return plan;
}

export { addPlanImages, removePlanImage, reorderPlanImages };
