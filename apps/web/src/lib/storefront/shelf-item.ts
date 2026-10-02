import type { PublicBundle, PublicProduct } from "@esencia-glow/shared";

/**
 * Forma única que consume el estante "Más vendidos / Kits" del home. Productos
 * y paquetes llegan del API con DTOs distintos; aquí se aplanan una sola vez
 * para que la tarjeta no sepa de qué colección viene.
 */
interface ShelfImage {
  url: string;
  alt?: string;
}

interface ShelfVariant {
  id: string;
  label: string;
  priceCents: number;
}

interface ShelfItem {
  id: string;
  kind: "product" | "kit";
  href: string;
  name: string;
  /** Marca del producto. Un kit no la lleva. */
  brand?: string;
  /** Cantidad de la presentación base ("30 ml"), o "N productos" en un kit. */
  quantityLabel: string;
  summary?: string;
  /** Hasta dos fotos: la principal y la que aparece al pasar el cursor. */
  images: ShelfImage[];
  priceCents: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  /** Cuántas presentaciones tiene el producto (0 en un kit). */
  variantCount: number;
  /** Vacío en un kit y en un producto de una sola variante. */
  variants: ShelfVariant[];
  badge?: { text: string; color: string };
}

/**
 * La primera variante es la "original": de ella salen la cantidad y el precio
 * que muestra la tarjeta (las demás presentaciones se eligen en el hover).
 */
function toShelfProduct(product: PublicProduct): ShelfItem {
  const base = product.variants[0]!;

  return {
    id: product.id,
    kind: "product",
    href: `/producto/${product.slug}`,
    name: product.name,
    brand: product.brand,
    quantityLabel: base.name,
    summary: product.shortDescription,
    images: product.images.slice(0, 2).map((image) => ({ url: image.url, alt: image.alt })),
    priceCents: base.price,
    listPriceCents: base.listPrice && base.listPrice > base.price ? base.listPrice : undefined,
    variantCount: product.variants.length,
    variants:
      product.variants.length > 1
        ? product.variants.map((variant) => ({ id: variant.id, label: variant.name, priceCents: variant.price }))
        : [],
    badge: product.badge,
  };
}

function toShelfKit(bundle: PublicBundle): ShelfItem {
  // Un paquete puede no tener fotos propias: se completa con las de sus piezas.
  const pool = [...bundle.images, ...bundle.items.flatMap((item) => (item.image ? [item.image] : []))];
  const units = bundle.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: bundle.id,
    kind: "kit",
    href: `/kit/${bundle.slug}`,
    name: bundle.name,
    quantityLabel: `${units} ${units === 1 ? "producto" : "productos"}`,
    summary: bundle.description,
    images: pool.slice(0, 2).map((image) => ({ url: image.url, alt: image.alt })),
    priceCents: bundle.price,
    listPriceCents: bundle.listPrice && bundle.listPrice > bundle.price ? bundle.listPrice : undefined,
    variantCount: 0,
    variants: [],
    badge: bundle.badge,
  };
}

export type { ShelfItem, ShelfImage, ShelfVariant };
export { toShelfProduct, toShelfKit };
