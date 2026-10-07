import type { ProductContent, ProductContentItem, PublicProduct, PublicVariantAvailability } from "@esencia-glow/shared";

/**
 * Forma que consume la página de producto. Aplana el DTO del API una sola vez:
 * precios y disponibilidad por presentación, y solo los bloques de contenido
 * que traen algo (un bloque vacío no se pinta).
 */
interface ProductViewImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

interface ProductViewVariant {
  id: string;
  label: string;
  priceCents: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  available: boolean;
}

type ContentKey = "benefits" | "routineSteps" | "usage" | "ingredients";

interface ProductViewSection {
  key: ContentKey;
  label: string;
  items: ProductContentItem[];
}

interface ProductView {
  id: string;
  slug: string;
  name: string;
  brand?: string;
  badge?: { text: string; color: string };
  description: string;
  category: { name: string; slug: string };
  images: ProductViewImage[];
  variants: ProductViewVariant[];
  sections: ProductViewSection[];
  /** Tipo de piel recomendado. Todavía no existe en el API: solo lo llena el preview. */
  skinTypes: string[];
}

// Orden en que se muestran los bloques, con su título para la clienta.
const SECTION_ORDER: Array<{ key: ContentKey; label: string }> = [
  { key: "benefits", label: "Beneficios" },
  { key: "routineSteps", label: "Paso de rutina" },
  { key: "usage", label: "Modo de uso" },
  { key: "ingredients", label: "Ingredientes" },
];

function toSections(content: ProductContent | undefined): ProductViewSection[] {
  if (!content) return [];
  return SECTION_ORDER.flatMap(({ key, label }) => {
    const items = content[key] ?? [];
    return items.length > 0 ? [{ key, label, items }] : [];
  });
}

/** Sin dato de disponibilidad se asume disponible: la reserva real decide al pagar. */
function toProductView(
  product: PublicProduct,
  availability: PublicVariantAvailability[],
  skinTypes: string[] = [],
): ProductView {
  const unavailable = new Set(availability.filter((entry) => !entry.isAvailable).map((entry) => entry.variantId));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    badge: product.badge,
    description: product.description,
    category: { name: product.category.name, slug: product.category.slug },
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? product.name,
      width: image.width,
      height: image.height,
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.name,
      priceCents: variant.price,
      listPriceCents: variant.listPrice && variant.listPrice > variant.price ? variant.listPrice : undefined,
      available: !unavailable.has(variant.id),
    })),
    sections: toSections(product.content),
    skinTypes,
  };
}

export { toProductView, toSections };
export type { ProductView, ProductViewImage, ProductViewVariant, ProductViewSection, ContentKey };
