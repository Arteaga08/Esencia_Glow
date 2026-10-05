type CatalogSort = "newest" | "price-asc";

/**
 * Filtros del catálogo, tal como viven en la URL (`?marca=A,B&min=250&max=400
 * &orden=precio&pagina=2`). Precios en pesos como texto (lo que teclea la
 * clienta); se convierten a centavos solo al pedirlos al API.
 */
interface CatalogFilters {
  brands: string[];
  min: string;
  max: string;
  sort: CatalogSort;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_CATALOG_FILTERS: CatalogFilters = { brands: [], min: "", max: "", sort: "newest" };

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "newest", label: "Lo más nuevo" },
  { value: "price-asc", label: "Precio: menor a mayor" },
];

/** Valor de `sort` que entiende `GET /products` (el default del API ya es el más nuevo). */
const API_SORT: Record<CatalogSort, string> = { newest: "-createdAt", "price-asc": "minPrice" };

const MAX_BRANDS = 10;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function cleanPesos(value: string): string {
  return /^\d{1,6}(\.\d{1,2})?$/.test(value) ? value : "";
}

/** Lee los filtros de la URL. Cualquier valor raro se descarta en vez de romper la página. */
function parseCatalogFilters(params: RawSearchParams): CatalogFilters {
  const brands = firstValue(params.marca)
    .split(",")
    .map((brand) => brand.trim())
    .filter((brand) => brand.length > 0 && brand.length <= 80)
    .slice(0, MAX_BRANDS);
  return {
    brands: [...new Set(brands)],
    min: cleanPesos(firstValue(params.min)),
    max: cleanPesos(firstValue(params.max)),
    sort: firstValue(params.orden) === "precio" ? "price-asc" : "newest",
  };
}

/** Número de página de la URL (`?pagina=2`); cualquier cosa inválida es la 1. */
function parsePage(params: RawSearchParams): number {
  const page = Number.parseInt(firstValue(params.pagina), 10);
  return Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1;
}

/** Inverso de `parseCatalogFilters`: sin filtros ni página devuelve cadena vacía. */
function catalogFiltersToQuery(filters: CatalogFilters, page = 1): string {
  const query = new URLSearchParams();
  if (filters.brands.length > 0) query.set("marca", filters.brands.join(","));
  if (filters.min) query.set("min", filters.min);
  if (filters.max) query.set("max", filters.max);
  if (filters.sort === "price-asc") query.set("orden", "precio");
  if (page > 1) query.set("pagina", String(page));
  return query.toString();
}

function pesosToCents(value: string): number | undefined {
  if (!value) return undefined;
  const pesos = Number(value);
  return Number.isNaN(pesos) ? undefined : Math.round(pesos * 100);
}

/** Parámetros de `GET /products` para estos filtros (sin categoría ni página). */
function catalogFiltersToApiParams(filters: CatalogFilters): Record<string, string> {
  const params: Record<string, string> = { sort: API_SORT[filters.sort] };
  if (filters.brands.length > 0) params.brand = filters.brands.join(",");
  const min = pesosToCents(filters.min);
  const max = pesosToCents(filters.max);
  if (min !== undefined) params.minPrice = String(min);
  if (max !== undefined) params.maxPrice = String(max);
  return params;
}

interface PricePreset {
  id: string;
  label: string;
  min: string;
  max: string;
}

function roundToFifty(pesos: number): number {
  return Math.round(pesos / 50) * 50;
}

/**
 * Atajos de precio ("Hasta $X", "$X a $Y", "Más de $Y") con cortes en el
 * tercio y los dos tercios del rango real de la categoría, redondeados a 50
 * pesos para que los números se lean limpios. Si el rango es muy estrecho no
 * hay atajos útiles y devuelve `[]`.
 */
function buildPricePresets(minCents: number | null, maxCents: number | null): PricePreset[] {
  if (minCents === null || maxCents === null) return [];
  const minPesos = minCents / 100;
  const maxPesos = maxCents / 100;
  const low = roundToFifty(minPesos + (maxPesos - minPesos) / 3);
  const high = roundToFifty(minPesos + ((maxPesos - minPesos) * 2) / 3);
  if (low <= 0 || high <= low || low <= minPesos || high >= maxPesos) return [];

  const money = (pesos: number) => `$${pesos.toLocaleString("es-MX")}`;
  return [
    { id: "low", label: `Hasta ${money(low)}`, min: "", max: String(low) },
    { id: "mid", label: `${money(low)} a ${money(high)}`, min: String(low), max: String(high) },
    { id: "high", label: `Más de ${money(high)}`, min: String(high), max: "" },
  ];
}

/** Cuántos filtros (sin contar el orden) hay activos. */
function countActiveCatalogFilters(filters: CatalogFilters): number {
  return filters.brands.length + (filters.min ? 1 : 0) + (filters.max ? 1 : 0);
}

export {
  DEFAULT_CATALOG_FILTERS,
  SORT_OPTIONS,
  parseCatalogFilters,
  parsePage,
  catalogFiltersToQuery,
  catalogFiltersToApiParams,
  buildPricePresets,
  countActiveCatalogFilters,
};
export type { CatalogFilters, PricePreset, CatalogSort, RawSearchParams };
