import "server-only";
import type { ApiResponse, PublicProduct } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { normalizeSearchTerm, type SearchPayload } from "./search-term";
import { toShelfProduct, type ShelfItem } from "./shelf-item";

// Un minuto de caché, igual que el catálogo.
const SEARCH_REVALIDATE_SECONDS = 60;
/** Productos que se ven al abrir el buscador, antes de escribir. */
const SEARCH_INITIAL_COUNT = 5;
/** Tope de resultados al escribir: dos filas de cinco en escritorio. */
const SEARCH_RESULT_COUNT = 10;

/** `null` si el API no responde: no es lo mismo que "no hay resultados". */
async function fetchProducts(query: Record<string, string>, limit: number): Promise<ShelfItem[] | null> {
  const params = new URLSearchParams({ limit: String(limit), ...query });
  try {
    const response = await fetch(`${API_URL}/api/v1/products?${params}`, { next: { revalidate: SEARCH_REVALIDATE_SECONDS } });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<PublicProduct[]>;
    if (payload.status !== "success") return null;
    return payload.data.filter((product) => product.variants.length > 0).map(toShelfProduct);
  } catch {
    return null;
  }
}

/** Al abrir: los más vendidos; si ninguno está marcado, lo más nuevo. */
async function getInitialProducts(): Promise<SearchPayload | null> {
  const bestsellers = await fetchProducts({ bestseller: "true" }, SEARCH_INITIAL_COUNT);
  if (bestsellers === null) return null;
  if (bestsellers.length > 0) return { kind: "bestsellers", items: bestsellers };
  const newest = await fetchProducts({}, SEARCH_INITIAL_COUNT);
  return newest === null ? null : { kind: "newest", items: newest };
}

/**
 * Buscador de la tienda. Sin texto (o con una sola letra) devuelve los
 * productos de bienvenida; con texto, lo que coincida por nombre, marca o
 * categoría (eso lo resuelve el API). `null` si el API no responde.
 */
async function searchProducts(rawTerm: string): Promise<SearchPayload | null> {
  const term = normalizeSearchTerm(rawTerm);
  if (!term) return getInitialProducts();
  const items = await fetchProducts({ search: term }, SEARCH_RESULT_COUNT);
  return items === null ? null : { kind: "results", items };
}

export { searchProducts };
