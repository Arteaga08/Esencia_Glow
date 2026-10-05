import "server-only";
import type { ApiResponse, PublicProduct } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { getCatalogFacets } from "./catalog";
import { getCategoryTree } from "./categories";
import { toShelfProduct, type ShelfItem } from "./shelf-item";
import type { SuggestionPayload } from "./suggestion-picker";

// Un minuto de caché, igual que el catálogo.
const SUGGESTIONS_REVALIDATE_SECONDS = 60;
const CANDIDATES_PER_SOURCE = 12;
const MAX_CATEGORIES = 3;
const MAX_BRANDS = 3;
// Una marca vista pesa más que una categoría: es una preferencia más específica.
const BRAND_SCORE = 3;

async function fetchProducts(query: Record<string, string>): Promise<ShelfItem[]> {
  const params = new URLSearchParams({ limit: String(CANDIDATES_PER_SOURCE), ...query });
  try {
    const response = await fetch(`${API_URL}/api/v1/products?${params}`, { next: { revalidate: SUGGESTIONS_REVALIDATE_SECONDS } });
    if (!response.ok) return [];
    const payload = (await response.json()) as ApiResponse<PublicProduct[]>;
    if (payload.status !== "success") return [];
    return payload.data.filter((product) => product.variants.length > 0).map(toShelfProduct);
  } catch {
    return [];
  }
}

/**
 * Solo pasan categorías y marcas que existen de verdad en el catálogo. Lo que
 * manda el navegador no es de fiar: sin este filtro cualquiera podría forzar
 * peticiones al API con valores inventados y gastar su límite de consultas.
 * Así, las URLs que se piden al API son un conjunto finito y cacheable.
 */
async function keepKnown(categories: string[], brands: string[]): Promise<{ categories: string[]; brands: string[] }> {
  const [tree, facets] = await Promise.all([getCategoryTree(), getCatalogFacets()]);
  const knownSlugs = new Set(tree.flatMap((root) => [root.slug, ...root.children.map((child) => child.slug)]));
  const knownBrands = new Set(facets.brands);
  return {
    categories: categories.filter((slug) => knownSlugs.has(slug)).slice(0, MAX_CATEGORIES),
    brands: brands.filter((brand) => knownBrands.has(brand)).slice(0, MAX_BRANDS),
  };
}

/**
 * Productos afines: los de las marcas y categorías que más ha visto. Cada
 * producto suma puntos por cada fuente en la que aparece (marca > categoría,
 * y la categoría más vista pesa más); a igual puntaje gana el más nuevo.
 */
async function getPersonalized(categories: string[], brands: string[]): Promise<ShelfItem[]> {
  const sources = await Promise.all([
    ...brands.map(async (brand) => ({ score: BRAND_SCORE, items: await fetchProducts({ brand }) })),
    ...categories.map(async (category, index) => ({
      score: categories.length - index,
      items: await fetchProducts({ category }),
    })),
  ]);

  const ranked = new Map<string, { item: ShelfItem; score: number; order: number }>();
  let order = 0;
  for (const source of sources) {
    for (const item of source.items) {
      const entry = ranked.get(item.id);
      if (entry) entry.score += source.score;
      else ranked.set(item.id, { item, score: source.score, order: order++ });
    }
  }
  return [...ranked.values()]
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, CANDIDATES_PER_SOURCE)
    .map((entry) => entry.item);
}

/** Relleno cuando no hay historial: más vendidos; si ninguno está marcado, lo más nuevo. */
async function getFallback(): Promise<SuggestionPayload["fallback"]> {
  const bestsellers = await fetchProducts({ bestseller: "true" });
  if (bestsellers.length > 0) return { kind: "bestsellers", items: bestsellers };
  return { kind: "newest", items: await fetchProducts({}) };
}

async function getSuggestions(input: { categories: string[]; brands: string[] }): Promise<SuggestionPayload> {
  const known = await keepKnown(input.categories, input.brands);
  const hasSignals = known.categories.length > 0 || known.brands.length > 0;
  const [personalized, fallback] = await Promise.all([
    hasSignals ? getPersonalized(known.categories, known.brands) : Promise.resolve([]),
    getFallback(),
  ]);
  return { personalized, fallback };
}

export { getSuggestions };
