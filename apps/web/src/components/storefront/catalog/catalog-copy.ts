/**
 * Textos del catálogo que cambian según lo que se recorre (productos de una
 * categoría, "Más vendidos" o kits). Los valores por defecto son los de producto.
 */
interface CatalogCopy {
  sectionLabel: string;
  countSingular: string;
  countPlural: string;
  filteredEmptyTitle: string;
  filteredEmptyDescription: string;
  emptyTitle: string;
  emptyDescription: string;
}

const PRODUCT_COPY: CatalogCopy = {
  sectionLabel: "Productos",
  countSingular: "producto",
  countPlural: "productos",
  filteredEmptyTitle: "Ningún producto coincide",
  filteredEmptyDescription: "Prueba con otra marca o amplía el rango de precio.",
  emptyTitle: "Aún no hay productos aquí",
  emptyDescription: "Vuelve pronto o explora otra categoría.",
};

const BESTSELLER_COPY: CatalogCopy = {
  ...PRODUCT_COPY,
  emptyTitle: "Aún no hay productos más vendidos",
};

const KIT_COPY: CatalogCopy = {
  sectionLabel: "Kits",
  countSingular: "kit",
  countPlural: "kits",
  filteredEmptyTitle: "Ningún kit coincide",
  filteredEmptyDescription: "Amplía el rango de precio para ver más kits.",
  emptyTitle: "Aún no hay kits",
  emptyDescription: "Vuelve pronto o explora el catálogo por categoría.",
};

export { PRODUCT_COPY, BESTSELLER_COPY, KIT_COPY };
export type { CatalogCopy };
