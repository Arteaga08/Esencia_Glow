import type { Types } from "mongoose";
import {
  CATALOG_CURRENCY,
  type PublicCategory,
  type PublicCategoryNode,
  type PublicProduct,
  type PublicProductImage,
  type PublicProductVariant,
  type ProductAttributes,
} from "@esencia-glow/shared";
import type { MediaImageAttrs } from "../models/media-image.schema.js";
import type {
  DimensionsCmAttrs,
  ProductVariantAttrs,
  VariantAttributesAttrs,
} from "../models/product-variant.schema.js";

/**
 * Único archivo que decide qué campos de Category/Product cruzan al cliente,
 * en las dos direcciones (admin y público). Recibe formas estructurales
 * (compatibles con `.lean()`), nunca un `HydratedDocument` — mismo precedente
 * que `buildPublicUser` en auth.service.ts.
 *
 * Lo que nunca cruza al público: `publicId` de Cloudinary, `bytes`, `format`,
 * `isActive`/`status` internos, timestamps, `__v`, `parentId` crudo.
 */

interface LeanMediaImage extends MediaImageAttrs {
  _id: Types.ObjectId;
}

interface LeanCategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  parentId: Types.ObjectId | null;
  image?: LeanMediaImage;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId: string | null;
  image?: PublicProductImage;
  sortOrder: number;
  isActive: boolean;
}

function buildImageDto(image?: LeanMediaImage): PublicProductImage | undefined {
  if (!image) return undefined;
  return {
    id: image._id.toString(),
    url: image.url,
    width: image.width,
    height: image.height,
    ...(image.alt ? { alt: image.alt } : {}),
  };
}

function buildAdminCategory(category: LeanCategory): AdminCategory {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    ...(category.description ? { description: category.description } : {}),
    parentId: category.parentId ? category.parentId.toString() : null,
    image: buildImageDto(category.image),
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

function buildPublicCategory(category: LeanCategory): PublicCategory {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    ...(category.description ? { description: category.description } : {}),
    image: buildImageDto(category.image),
    sortOrder: category.sortOrder,
  };
}

/** Arma el árbol de dos niveles a partir de una lista plana ya filtrada (activas). */
function buildCategoryTree(categories: LeanCategory[]): PublicCategoryNode[] {
  const roots = categories.filter((category) => category.parentId === null);
  const childrenByParent = new Map<string, LeanCategory[]>();

  for (const category of categories) {
    if (!category.parentId) continue;
    const key = category.parentId.toString();
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(category);
    childrenByParent.set(key, siblings);
  }

  return roots.map((root) => ({
    ...buildPublicCategory(root),
    children: (childrenByParent.get(root._id.toString()) ?? []).map(buildPublicCategory),
  }));
}

interface LeanVariant extends Omit<ProductVariantAttrs, "attributes" | "dimensionsCm"> {
  _id: Types.ObjectId;
  // Mongoose omite un subdocumento embebido vacío al guardar (`minimize`),
  // así que una variante sin atributos llega desde `.lean()` sin esta clave.
  attributes?: VariantAttributesAttrs;
  dimensionsCm: DimensionsCmAttrs;
}

interface LeanProduct {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  categoryId: Types.ObjectId;
  status: string;
  images: LeanMediaImage[];
  variants: LeanVariant[];
  minPrice: number;
}

interface AdminVariant extends PublicProductVariant {
  isActive: boolean;
}

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  status: string;
  images: PublicProductImage[];
  variants: AdminVariant[];
  minPrice: number;
}

// Mongoose (`minimize: true` por defecto) omite un subdocumento embebido que
// quedó vacío al guardar — un `.lean()` de una variante sin talla/tono/volumen
// trae `attributes: undefined`, no `{}`. Defensivo por eso.
function buildAttributesDto(attributes?: VariantAttributesAttrs): ProductAttributes {
  if (!attributes) return {};
  return {
    ...(attributes.size ? { size: attributes.size } : {}),
    ...(attributes.shade ? { shade: attributes.shade } : {}),
    ...(attributes.volume ? { volume: attributes.volume } : {}),
  };
}

function buildAdminVariant(variant: LeanVariant): AdminVariant {
  return {
    id: variant._id.toString(),
    sku: variant.sku,
    name: variant.name,
    attributes: buildAttributesDto(variant.attributes),
    price: variant.price,
    weightGrams: variant.weightGrams,
    dimensionsCm: variant.dimensionsCm,
    isActive: variant.isActive,
  };
}

function buildPublicVariant(variant: LeanVariant): PublicProductVariant {
  return {
    id: variant._id.toString(),
    sku: variant.sku,
    name: variant.name,
    attributes: buildAttributesDto(variant.attributes),
    price: variant.price,
    weightGrams: variant.weightGrams,
    dimensionsCm: variant.dimensionsCm,
  };
}

function buildAdminProduct(product: LeanProduct): AdminProduct {
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    description: product.description,
    ...(product.shortDescription ? { shortDescription: product.shortDescription } : {}),
    categoryId: product.categoryId.toString(),
    status: product.status,
    images: product.images.map((image) => buildImageDto(image)!),
    variants: product.variants.map(buildAdminVariant),
    minPrice: product.minPrice,
  };
}

/**
 * DTO público de producto. Solo cruzan las variantes activas — una variante
 * apagada no es comprable y no debe mostrarse en el storefront.
 */
function buildPublicProduct(
  product: LeanProduct,
  category: { id: string; name: string; slug: string },
): PublicProduct {
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    description: product.description,
    ...(product.shortDescription ? { shortDescription: product.shortDescription } : {}),
    category,
    images: product.images.map((image) => buildImageDto(image)!),
    variants: product.variants.filter((variant) => variant.isActive).map(buildPublicVariant),
    minPrice: product.minPrice,
    currency: CATALOG_CURRENCY,
  };
}

export {
  buildAdminCategory,
  buildPublicCategory,
  buildCategoryTree,
  buildAdminProduct,
  buildPublicProduct,
  buildAdminVariant,
  buildPublicVariant,
};
export type { LeanCategory, LeanMediaImage, LeanProduct, LeanVariant, AdminCategory, AdminProduct };
