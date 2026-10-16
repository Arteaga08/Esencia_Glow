import "server-only";
import type { ApiResponse, PublicProduct } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { internalApiHeaders } from "../server-api";
import { classifyUpstreamStatus } from "../upstream-status";
import { normalizeSearchTerm, type SearchPayload } from "./search-term";
import { toShelfProduct, type ShelfItem } from "./shelf-item";

// Un minuto de caché, igual que el catálogo.
const SEARCH_REVALIDATE_SECONDS = 60;
/** Productos que se ven al abrir el buscador, antes de escribir. */
const SEARCH_INITIAL_COUNT = 5;
/** Tope de resultados al escribir: dos filas de cinco en escritorio. */
const SEARCH_RESULT_COUNT = 10;

/** El API dijo "demasiadas peticiones" a esta persona: se distingue de "no responde" para avisarle. */
const RATE_LIMITED = "rate-limited";
type RateLimited = typeof RATE_LIMITED;

/**
 * `null` si el API no responde: no es lo mismo que "no hay resultados".
 * `forVisitor`: el texto lo escribe quien busca, así que la llamada lleva su IP
 * (el API cuenta su cuota, no la del servidor web) y no se cachea compartida;
 * los productos de bienvenida son iguales para todos y sí se cachean.
 */
async function fetchProducts(
  query: Record<string, string>,
  limit: number,
  forVisitor = false,
): Promise<ShelfItem[] | null | RateLimited> {
  const params = new URLSearchParams({ limit: String(limit), ...query });
  try {
    const response = await fetch(`${API_URL}/api/v1/products?${params}`, {
      headers: await internalApiHeaders({ visitor: forVisitor }),
      ...(forVisitor ? { cache: "no-store" as const } : { next: { revalidate: SEARCH_REVALIDATE_SECONDS } }),
    });
    const outcome = classifyUpstreamStatus(response.status);
    if (outcome === "rate-limited") return RATE_LIMITED;
    if (outcome !== "ok") return null;
    const payload = (await response.json()) as ApiResponse<PublicProduct[]>;
    if (payload.status !== "success") return null;
    return payload.data.filter((product) => product.variants.length > 0).map(toShelfProduct);
  } catch {
    return null;
  }
}

/** Al abrir: los más vendidos; si ninguno está marcado, lo más nuevo. */
async function getInitialProducts(): Promise<SearchPayload | null | RateLimited> {
  const bestsellers = await fetchProducts({ bestseller: "true" }, SEARCH_INITIAL_COUNT);
  if (bestsellers === null || bestsellers === RATE_LIMITED) return bestsellers;
  if (bestsellers.length > 0) return { kind: "bestsellers", items: bestsellers };
  const newest = await fetchProducts({}, SEARCH_INITIAL_COUNT);
  if (newest === null || newest === RATE_LIMITED) return newest;
  return { kind: "newest", items: newest };
}

/**
 * Buscador de la tienda. Sin texto (o con una sola letra) devuelve los
 * productos de bienvenida; con texto, lo que coincida por nombre, marca o
 * categoría (eso lo resuelve el API). `null` si el API no responde y
 * `"rate-limited"` si esta persona ya hizo demasiadas búsquedas.
 */
async function searchProducts(rawTerm: string): Promise<SearchPayload | null | RateLimited> {
  const term = normalizeSearchTerm(rawTerm);
  if (!term) return getInitialProducts();
  const items = await fetchProducts({ search: term }, SEARCH_RESULT_COUNT, true);
  if (items === null || items === RATE_LIMITED) return items;
  return { kind: "results", items };
}

export { searchProducts, RATE_LIMITED };
