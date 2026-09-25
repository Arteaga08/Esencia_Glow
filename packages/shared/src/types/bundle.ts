import type { Currency } from "../constants/currency.js";
import type { PublicBadge } from "./badge.js";
import type { ProductAttributes, ProductContent, PublicProductImage } from "./catalog.js";

/**
 * DTO público de un paquete. `items` viene enriquecido (nombre y atributos
 * del producto/variante que compone cada línea, con su imagen) porque un
 * bundle SÍ necesita mostrar qué incluye — a diferencia de `PublicProduct`,
 * que no expone nada de otra colección. Nunca incluye stock: igual que
 * `PublicProduct`, la disponibilidad se decide al reservar, no se anuncia.
 */
interface PublicBundleItem {
  productId: string;
  variantId: string;
  name: string;
  attributes: ProductAttributes;
  image?: PublicProductImage;
  quantity: number;
}

interface PublicBundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: PublicProductImage[];
  /** Centavos de la moneda del catálogo. Manual, independiente de sus componentes. */
  price: number;
  /**
   * Precio de lista, centavos — SOLO presentación (el "antes" tachado).
   * Nunca es lo que se cobra; ausente/`null` cuando no hay descuento visual.
   */
  listPrice?: number | null;
  currency: Currency;
  items: PublicBundleItem[];
  /** A lo más una por paquete (Bundle.badgeId). Ausente si no tiene. */
  badge?: PublicBadge;
  content?: ProductContent;
}

/** Señal de disponibilidad de un paquete — igual criterio que
 * `PublicVariantAvailability`, nunca el conteo real. */
interface PublicBundleAvailability {
  isAvailable: boolean;
}

export type { PublicBundleItem, PublicBundle, PublicBundleAvailability };
