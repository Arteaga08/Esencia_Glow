import "server-only";
import type {
  ApiResponse,
  PaginationMeta,
  PublicCategory,
  PublicCategoryNode,
  PublicProduct,
  PublicProductFacets,
} from "@esencia-glow/shared";
import { API_URL } from "../config";
import { catalogFiltersToApiParams, type CatalogFilters } from "./catalog-filters";
import { toShelfProduct, type ShelfItem } from "./shelf-item";

// Un minuto de caché, igual que el home: se ve rápido un cambio del panel.
const CATALOG_REVALIDATE_SECONDS = 60;
const CATALOG_PAGE_SIZE = 24;

const EMPTY_FACETS: PublicProductFacets = { brands: [], minPrice: null, maxPrice: null };

/** Categoría pedida por slug, con su padre si es una subcategoría. */
interface CatalogCategory {
  category: PublicCategory;
  /** Raíz de la que cuelga; `undefined` si la categoría ya es raíz. */
  parent?: PublicCategoryNode;
  /** Raíz de la que salen las subcategorías: la propia categoría o su padre. */
  root: PublicCategoryNode;
}

function findCatalogCategory(tree: PublicCategoryNode[], slug: string): CatalogCategory | null {
  for (const root of tree) {
    if (root.slug === slug) return { category: root, root };
    const child = root.children.find((candidate) => candidate.slug === slug);
    if (child) return { category: child, parent: root, root };
  }
  return null;
}

/** Qué productos recorre el catálogo: los de una categoría, los marcados "Más vendido" o los que están en oferta. */
interface CatalogScope {
  category?: string;
  bestseller?: boolean;
  onSale?: boolean;
}

interface CatalogPage {
  items: ShelfItem[];
  meta: PaginationMeta;
}

function scopeToParams(scope: CatalogScope): Record<string, string> {
  return {
    ...(scope.category ? { category: scope.category } : {}),
    ...(scope.bestseller ? { bestseller: "true" } : {}),
    ...(scope.onSale ? { onSale: "true" } : {}),
  };
}

/**
 * Una página de productos del alcance con los filtros aplicados. Devuelve
 * `null` si el API no responde, para que la página muestre un error en vez de
 * un catálogo vacío que parezca verdadero.
 */
async function getCatalogPage(scope: CatalogScope, filters: CatalogFilters, page: number): Promise<CatalogPage | null> {
  const query = new URLSearchParams({
    ...scopeToParams(scope),
    page: String(page),
    limit: String(CATALOG_PAGE_SIZE),
    ...catalogFiltersToApiParams(filters),
  });
  try {
    const response = await fetch(`${API_URL}/api/v1/products?${query}`, { next: { revalidate: CATALOG_REVALIDATE_SECONDS } });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<PublicProduct[]>;
    if (payload.status !== "success" || !payload.meta) return null;
    return {
      items: payload.data.filter((product) => product.variants.length > 0).map(toShelfProduct),
      meta: payload.meta,
    };
  } catch {
    return null;
  }
}

/**
 * Marcas y rango de precio del alcance (todo el catálogo si no se pasa
 * ninguno); vacío si el API no responde (los filtros se ocultan).
 */
async function getCatalogFacets(scope: CatalogScope = {}): Promise<PublicProductFacets> {
  try {
    const params = new URLSearchParams(scopeToParams(scope));
    const query = params.size > 0 ? `?${params}` : "";
    const response = await fetch(`${API_URL}/api/v1/products/facets${query}`, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
    });
    if (!response.ok) return EMPTY_FACETS;
    const payload = (await response.json()) as ApiResponse<PublicProductFacets>;
    return payload.status === "success" ? payload.data : EMPTY_FACETS;
  } catch {
    return EMPTY_FACETS;
  }
}

export { CATALOG_PAGE_SIZE, findCatalogCategory, getCatalogPage, getCatalogFacets };
export type { CatalogCategory, CatalogPage, CatalogScope };
