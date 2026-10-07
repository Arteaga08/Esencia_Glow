import type { PublicBundle } from "@esencia-glow/shared";
import { toSections, type ProductViewImage, type ProductViewSection } from "./product-view";

/**
 * Forma que consume la página de un kit. Aplana el DTO del API una sola vez:
 * fotos (las del kit o, si no tiene, las de sus piezas), precio con su tachado
 * y los productos que incluye, ya con nombre y presentación separados.
 */
interface KitViewItem {
  /** Clave estable de la línea: el mismo producto puede entrar con dos presentaciones. */
  key: string;
  name: string;
  /** Presentación ("30 ml"); vacía si el API no la separó. */
  presentation: string;
  quantity: number;
  image?: { url: string; alt: string };
  /** Solo si el producto está publicado; sin él la línea no es enlace. */
  href?: string;
}

interface KitView {
  id: string;
  slug: string;
  name: string;
  badge?: { text: string; color: string };
  description: string;
  images: ProductViewImage[];
  priceCents: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  /** "N productos": suma de unidades de todas las piezas. */
  unitsLabel: string;
  available: boolean;
  items: KitViewItem[];
  sections: ProductViewSection[];
}

// El API arma el nombre de cada pieza como "Producto — Presentación".
const NAME_SEPARATOR = " \u2014 ";

/** Separa "Sérum — 30 ml" en nombre y presentación; sin separador todo es nombre. */
function splitItemName(full: string): { name: string; presentation: string } {
  const at = full.lastIndexOf(NAME_SEPARATOR);
  if (at === -1) return { name: full, presentation: "" };
  return { name: full.slice(0, at), presentation: full.slice(at + NAME_SEPARATOR.length) };
}

function countUnits(bundle: PublicBundle): number {
  return bundle.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Sin dato de disponibilidad se asume disponible: la reserva real decide al pagar. */
function toKitView(bundle: PublicBundle, available = true): KitView {
  const units = countUnits(bundle);
  const own = bundle.images.map((image) => ({
    url: image.url,
    alt: image.alt ?? bundle.name,
    width: image.width,
    height: image.height,
  }));
  const fromItems = bundle.items.flatMap((item) =>
    item.image
      ? [{ url: item.image.url, alt: item.image.alt ?? splitItemName(item.name).name, width: item.image.width, height: item.image.height }]
      : [],
  );

  return {
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    badge: bundle.badge,
    description: bundle.description,
    images: own.length > 0 ? own : fromItems,
    priceCents: bundle.price,
    listPriceCents: bundle.listPrice && bundle.listPrice > bundle.price ? bundle.listPrice : undefined,
    unitsLabel: `${units} ${units === 1 ? "producto" : "productos"}`,
    available,
    items: bundle.items.map((item) => {
      const { name, presentation } = splitItemName(item.name);
      return {
        key: `${item.productId}:${item.variantId}`,
        name,
        presentation,
        quantity: item.quantity,
        image: item.image ? { url: item.image.url, alt: item.image.alt ?? name } : undefined,
        href: item.productSlug ? `/producto/${item.productSlug}` : undefined,
      };
    }),
    sections: toSections(bundle.content),
  };
}

export { toKitView, splitItemName };
export type { KitView, KitViewItem };
