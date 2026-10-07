import type { ShelfItem } from "./shelf-item";

/** Con menos letras que esto no se busca: una sola letra coincide con casi todo. */
const SEARCH_MIN_LENGTH = 2;
// Mismo tope que acepta el API en `search`.
const SEARCH_MAX_LENGTH = 80;

/** Lo que devuelve `GET /api/storefront/search`. */
interface SearchPayload {
  /** `results` cuando hubo texto; si no, qué se muestra al abrir el buscador. */
  kind: "results" | "bestsellers" | "newest";
  items: ShelfItem[];
}

/**
 * Deja el texto listo para buscar: sin espacios de sobra, en minúsculas (el
 * API ya ignora mayúsculas, así "Cosrx" y "cosrx" comparten caché) y acotado.
 * Devuelve "" si es demasiado corto: eso significa "todavía no busques".
 */
function normalizeSearchTerm(raw: string): string {
  const term = raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, SEARCH_MAX_LENGTH).trim();
  return term.length >= SEARCH_MIN_LENGTH ? term : "";
}

export { normalizeSearchTerm, SEARCH_MIN_LENGTH, SEARCH_MAX_LENGTH };
export type { SearchPayload };
