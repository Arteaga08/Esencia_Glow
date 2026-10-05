/**
 * Lo que la clienta ha ido viendo, guardado SOLO en su navegador
 * (`localStorage`): cuántas veces entró a cada categoría y qué marcas filtró.
 * No lleva datos personales, no viaja al servidor por sí solo y no la sigue a
 * otro dispositivo. Alimenta el bloque "Sugeridos para ti".
 */
interface BrowsingHistory {
  categories: Record<string, number>;
  brands: Record<string, number>;
}

interface BrowsingSignals {
  /** Slugs de las categorías más vistas, de mayor a menor interés. */
  categories: string[];
  brands: string[];
}

const STORAGE_KEY = "esencia-glow:browsing:v1";
// Tope de entradas por tipo: al pasarlo se descartan las menos vistas.
const MAX_ENTRIES = 20;
const TOP_CATEGORIES = 3;
const TOP_BRANDS = 3;

const EMPTY_HISTORY: BrowsingHistory = { categories: {}, brands: {} };

function isCountMap(value: unknown): value is Record<string, number> {
  return typeof value === "object" && value !== null && Object.values(value).every((count) => typeof count === "number");
}

/** `localStorage` puede faltar o estar bloqueado (modo privado): ahí no hay historial y nada se rompe. */
function readBrowsingHistory(): BrowsingHistory {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_HISTORY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_HISTORY;
    const { categories, brands } = parsed as Partial<BrowsingHistory>;
    return { categories: isCountMap(categories) ? categories : {}, brands: isCountMap(brands) ? brands : {} };
  } catch {
    return EMPTY_HISTORY;
  }
}

function rankKeys(counts: Record<string, number>): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
}

function bump(counts: Record<string, number>, keys: string[]): Record<string, number> {
  const next = { ...counts };
  for (const key of keys) next[key] = (next[key] ?? 0) + 1;
  return Object.fromEntries(rankKeys(next).slice(0, MAX_ENTRIES).map((key) => [key, next[key]!]));
}

/** Suma una visita a la categoría y un punto a cada marca indicada. */
function recordBrowsing(input: { category?: string; brands?: string[] }): void {
  try {
    const history = readBrowsingHistory();
    const next: BrowsingHistory = {
      categories: input.category ? bump(history.categories, [input.category]) : history.categories,
      brands: input.brands?.length ? bump(history.brands, input.brands) : history.brands,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento disponible no se recuerda nada; el bloque cae a los más vendidos.
  }
}

/** Las categorías y marcas que más le interesan, listas para pedir sugerencias. */
function readBrowsingSignals(): BrowsingSignals {
  const history = readBrowsingHistory();
  return {
    categories: rankKeys(history.categories).slice(0, TOP_CATEGORIES),
    brands: rankKeys(history.brands).slice(0, TOP_BRANDS),
  };
}

export { recordBrowsing, readBrowsingSignals };
export type { BrowsingSignals };
