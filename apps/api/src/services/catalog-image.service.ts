import { Product, type ProductDocument } from "../models/product.model.js";
import { getCategoryDocument } from "./category.service.js";
import { uploadImage, destroyImage } from "./upload.service.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import type { CategoryDocument } from "../models/category.model.js";
import type { MediaAsset } from "./media-provider.js";

const MAX_PRODUCT_IMAGES = 8;

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

async function getProductOrThrow(productId: string): Promise<ProductDocument> {
  const product = await Product.findById(productId);
  if (!product) throw new AppError("Producto no encontrado", 404);
  return product;
}

/**
 * Sube y adjunta imágenes a un producto. Sin transacción entre Cloudinary y
 * Mongo: si `save()` falla después de subir, se borran los assets recién
 * subidos en el `catch` — la compensación evita dejarlos pagados y huérfanos.
 */
async function addProductImages(
  productId: string,
  buffers: Buffer[],
  alt?: string,
): Promise<ProductDocument> {
  const product = await getProductOrThrow(productId);
  if (product.images.length + buffers.length > MAX_PRODUCT_IMAGES) {
    throw new AppError(`Un producto admite máximo ${MAX_PRODUCT_IMAGES} imágenes`, 400);
  }

  const uploaded: MediaAsset[] = [];
  try {
    for (const buffer of buffers) {
      uploaded.push(await uploadImage({ buffer, folder: "products" }));
    }
    product.images.push(...uploaded.map((asset) => toImageSubdocument(asset, alt)));
    await product.save();
    return product;
  } catch (error) {
    await Promise.all(uploaded.map((asset) => destroyBestEffort(asset.publicId)));
    throw error;
  }
}

async function removeProductImage(productId: string, imageId: string): Promise<ProductDocument> {
  const product = await getProductOrThrow(productId);
  const image = product.images.id(imageId);
  if (!image) throw new AppError("Imagen no encontrada", 404);

  const publicId = image.publicId;
  image.deleteOne();
  await product.save();
  await destroyBestEffort(publicId);
  return product;
}

async function reorderProductImages(
  productId: string,
  imageIds: string[],
): Promise<ProductDocument> {
  const product = await getProductOrThrow(productId);
  const byId = new Map(product.images.map((image) => [image.id as string, image]));

  if (imageIds.length !== product.images.length || !imageIds.every((id) => byId.has(id))) {
    throw new AppError("La lista de imágenes no coincide con las imágenes actuales", 400);
  }

  const reordered = imageIds.map((id) => byId.get(id)!);
  // splice en sitio (no reasignar): preserva la identidad del DocumentArray
  // en vez de intentar asignarle un array plano.
  product.images.splice(0, product.images.length, ...reordered);
  await product.save();
  return product;
}

async function setCategoryImage(
  categoryId: string,
  buffer: Buffer,
  alt?: string,
): Promise<CategoryDocument> {
  const category = await getCategoryDocument(categoryId);
  const previousPublicId = category.image?.publicId;

  const asset = await uploadImage({ buffer, folder: "categories" });
  try {
    category.image = toImageSubdocument(asset, alt);
    await category.save();
  } catch (error) {
    await destroyBestEffort(asset.publicId);
    throw error;
  }

  if (previousPublicId) await destroyBestEffort(previousPublicId);
  return category;
}

async function removeCategoryImage(categoryId: string): Promise<CategoryDocument> {
  const category = await getCategoryDocument(categoryId);
  if (!category.image) throw new AppError("La categoría no tiene imagen", 404);

  const publicId = category.image.publicId;
  category.image = undefined;
  await category.save();
  await destroyBestEffort(publicId);
  return category;
}

export {
  addProductImages,
  removeProductImage,
  reorderProductImages,
  setCategoryImage,
  removeCategoryImage,
};
