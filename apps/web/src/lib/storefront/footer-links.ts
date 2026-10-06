import type { PublicCategoryNode } from "@esencia-glow/shared";

/**
 * Columnas de enlaces del footer. Casi todas las rutas de destino todavía no
 * existen (mismo criterio que el navbar con /buscar, /cuenta, /ofertas): se
 * pintan ya para que el footer quede completo cuando lleguen las páginas.
 */

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const SHOP_CATEGORY_LIMIT = 4;

const SHOP_FIXED_LINKS: FooterLink[] = [
  { label: "Kits", href: "/kits" },
  { label: "Ofertas", href: "/ofertas" },
];

const STATIC_COLUMNS: FooterColumn[] = [
  {
    title: "Nosotras",
    links: [
      { label: "Nuestra historia", href: "/nosotras" },
      { label: "Ingredientes", href: "/ingredientes" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Envíos y entregas", href: "/envios" },
      { label: "Cambios y devoluciones", href: "/devoluciones" },
      { label: "Preguntas frecuentes", href: "/preguntas-frecuentes" },
      { label: "Contacto", href: "/contacto" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y condiciones", href: "/terminos" },
      { label: "Aviso de privacidad", href: "/privacidad" },
      { label: "Política de cookies", href: "/cookies" },
    ],
  },
  {
    title: "Suscripción",
    links: [
      { label: "Cómo funciona", href: "/suscripcion" },
      { label: "Planes", href: "/suscripcion#planes" },
      { label: "Mi suscripción", href: "/mi-cuenta/suscripcion" },
    ],
  },
];

/** Columna "Tienda": categorías raíz reales (máx. 4) + Kits y Ofertas. */
function buildShopColumn(categories: PublicCategoryNode[]): FooterColumn {
  const categoryLinks = categories.slice(0, SHOP_CATEGORY_LIMIT).map((category) => ({
    label: category.name,
    href: `/categoria/${category.slug}`,
  }));
  return { title: "Tienda", links: [...categoryLinks, ...SHOP_FIXED_LINKS] };
}

/** Las cinco columnas, en el orden en que se muestran. */
function buildFooterColumns(categories: PublicCategoryNode[]): FooterColumn[] {
  return [buildShopColumn(categories), ...STATIC_COLUMNS];
}

export { buildFooterColumns };
export type { FooterColumn, FooterLink };
