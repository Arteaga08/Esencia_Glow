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
  /**
   * Precio de lista, centavos — SOLO presentación (el "antes" tachado).
   * Nunca es lo que se cobra; ausente/`null` cuando no hay descuento visual.
   */
  listPrice?: number | null;
  weightGrams: number;
  dimensionsCm: PublicDimensionsCm;
}

interface PublicProductCategoryRef {
  id: string;
  name: string;
  slug: string;
}

/** Un elemento de contenido editorial: título (en negrita en el storefront) + texto. */
interface ProductContentItem {
  title: string;
  text: string;
}

/** Ingredientes, pasos de rutina, modo de uso y beneficios — cada uno opcional. */
interface ProductContent {
  ingredients?: ProductContentItem[];
  routineSteps?: ProductContentItem[];
  usage?: ProductContentItem[];
  benefits?: ProductContentItem[];
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
  content?: ProductContent;
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

/**
 * Señal de disponibilidad por variante — nunca el número de `onHand`/
 * `reserved` (información de negocio, ver §"Disponibilidad pública" de
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md).
 */
interface PublicVariantAvailability {
  variantId: string;
  sku: string;
  isAvailable: boolean;
}

export type {
  ProductAttributes,
  PublicProductImage,
  PublicDimensionsCm,
  PublicProductVariant,
  PublicProductCategoryRef,
  ProductContentItem,
  ProductContent,
  PublicProduct,
  PublicCategory,
  PublicCategoryNode,
  PublicVariantAvailability,
};
