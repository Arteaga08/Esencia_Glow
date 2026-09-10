import type { Currency } from "../constants/currency.js";
import type { PublicBadge } from "./badge.js";

/**
 * DTOs públicos del catálogo. Los arma `catalog-dto.ts` en la API — es el
 * único lugar que decide qué campos de Product/Category cruzan al cliente.
 * `weightGrams`/`dimensionsCm` sí cruzan: el storefront (Milestone 3) cotiza
 * envío con Skydropx desde el carrito antes de crear la orden (Milestone 1.5).
 *
 * Lo que nunca cruza: `publicId` de Cloudinary, `status`, `isActive` de
 * variante, `bytes`/`format` de imagen, timestamps, `__v`, `parentId` crudo.
 */

interface ProductAttributes {
  size?: string;
  shade?: string;
  volume?: string;
}

interface PublicProductImage {
  id: string;
  url: string;
  width: number;
  height: number;
  alt?: string;
}

interface PublicDimensionsCm {
  length: number;
  width: number;
  height: number;
}

interface PublicProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: ProductAttributes;
  /** Centavos de la moneda del catálogo. */
  price: number;
  weightGrams: number;
  dimensionsCm: PublicDimensionsCm;
}

interface PublicProductCategoryRef {
  id: string;
  name: string;
  slug: string;
}

interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: PublicProductCategoryRef;
  images: PublicProductImage[];
  variants: PublicProductVariant[];
  /** Precio desde, derivado de las variantes activas. Centavos. */
  minPrice: number;
  currency: Currency;
  /** A lo más una por producto (Product.badgeId). Ausente si no tiene. */
  badge?: PublicBadge;
}

interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: PublicProductImage;
  sortOrder: number;
}

interface PublicCategoryNode extends PublicCategory {
  children: PublicCategory[];
}

export type {
  ProductAttributes,
  PublicProductImage,
  PublicDimensionsCm,
  PublicProductVariant,
  PublicProductCategoryRef,
  PublicProduct,
  PublicCategory,
  PublicCategoryNode,
};
