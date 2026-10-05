import type { ShelfItem } from "./shelf-item";

type SuggestionFallbackKind = "bestsellers" | "newest";

/** Lo que devuelve `GET /api/storefront/suggestions`. */
interface SuggestionPayload {
  /** Productos afines a lo que ha visto la clienta, del más al menos afín. */
  personalized: ShelfItem[];
  fallback: { kind: SuggestionFallbackKind; items: ShelfItem[] };
}

interface PickedSuggestions {
  kind: "personalized" | SuggestionFallbackKind;
  items: ShelfItem[];
}

// Tarjetas del carrusel: cuatro a la vista en escritorio y otras tantas al deslizar.
const SUGGESTION_COUNT = 8;
// Con menos afines que esto el bloque no se presenta como "para ti".
const MIN_PERSONALIZED = 2;

/**
 * Elige las tarjetas del carrusel. Primero los afines que no estén ya en
 * la rejilla de la página; si no alcanzan, completa con el relleno (más
 * vendidos o, si no hay ninguno marcado, lo más nuevo). Solo se titula
 * "Sugeridos para ti" cuando al menos dos tarjetas salen de su historial.
 */
function pickSuggestions(payload: SuggestionPayload, excludeIds: string[]): PickedSuggestions {
  const excluded = new Set(excludeIds);
  const personalized = payload.personalized.filter((item) => !excluded.has(item.id)).slice(0, SUGGESTION_COUNT);
  const chosen = new Set(personalized.map((item) => item.id));

  const fill = (candidates: ShelfItem[], target: ShelfItem[]) => {
    for (const item of candidates) {
      if (target.length >= SUGGESTION_COUNT) break;
      if (chosen.has(item.id)) continue;
      chosen.add(item.id);
      target.push(item);
    }
  };

  const items = [...personalized];
  fill(payload.fallback.items.filter((item) => !excluded.has(item.id)), items);
  // Último recurso: repetir algo de la rejilla antes que dejar el bloque cojo.
  fill(payload.fallback.items, items);

  return { kind: personalized.length >= MIN_PERSONALIZED ? "personalized" : payload.fallback.kind, items };
}

export { pickSuggestions, SUGGESTION_COUNT };
export type { SuggestionPayload, SuggestionFallbackKind, PickedSuggestions };
