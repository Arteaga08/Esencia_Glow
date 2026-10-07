import "server-only";
import type { ApiResponse, PaginationMeta, PublicBundle, PublicBundleAvailability, PublicBundleFacets, PublicProductFacets } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { kitFiltersToApiParams, type CatalogFilters } from "./catalog-filters";
import { CATALOG_PAGE_SIZE, type CatalogPage } from "./catalog";
import { toShelfKit } from "./shelf-item";

// Mismos tiempos que producto: el kit un minuto, la disponibilidad más seguido.
const KIT_REVALIDATE_SECONDS = 60;
const AVAILABILITY_REVALIDATE_SECONDS = 15;

type KitLookup = { kind: "found"; bundle: PublicBundle } | { kind: "not-found" } | { kind: "error" };

/**
 * Kit público por slug. Distingue "no existe" (404 real) de "el API no
 * responde", igual que `getProduct`: una caída del API no debe parecer que
 * el kit desapareció.
 */
async function getKit(slug: string): Promise<KitLookup> {
  try {
    const response = await fetch(`${API_URL}/api/v1/bundles/${encodeURIComponent(slug)}`, {
      next: { revalidate: KIT_REVALIDATE_SECONDS },
    });
    if (response.status === 404) return { kind: "not-found" };
    if (!response.ok) return { kind: "error" };
    const payload = (await response.json()) as ApiResponse<PublicBundle>;
    return payload.status === "success" ? { kind: "found", bundle: payload.data } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Si el kit se puede armar hoy. Si el API no responde devuelve `true`: la
 * página no bloquea la compra por eso, la reserva real decide al pagar.
 */
async function getKitAvailability(slug: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/v1/bundles/${encodeURIComponent(slug)}/availability`, {
      next: { revalidate: AVAILABILITY_REVALIDATE_SECONDS },
    });
    if (!response.ok) return true;
    const payload = (await response.json()) as ApiResponse<PublicBundleAvailability>;
    return payload.status === "success" ? payload.data.isAvailable : true;
  } catch {
    return true;
  }
}

/** Una página de kits con precio y orden aplicados; `null` si el API no responde. */
async function getKitsPage(filters: CatalogFilters, page: number): Promise<CatalogPage | null> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(CATALOG_PAGE_SIZE),
    ...kitFiltersToApiParams(filters),
  });
  try {
    const response = await fetch(`${API_URL}/api/v1/bundles?${query}`, { next: { revalidate: KIT_REVALIDATE_SECONDS } });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<PublicBundle[]>;
    if (payload.status !== "success" || !payload.meta) return null;
    return { items: payload.data.map(toShelfKit), meta: payload.meta as PaginationMeta };
  } catch {
    return null;
  }
}

/** Rango de precio de los kits publicados, con la forma de las facetas del catálogo (sin marcas: un kit no tiene). */
async function getKitFacets(): Promise<PublicProductFacets> {
  const empty: PublicProductFacets = { brands: [], minPrice: null, maxPrice: null };
  try {
    const response = await fetch(`${API_URL}/api/v1/bundles/facets`, { next: { revalidate: KIT_REVALIDATE_SECONDS } });
    if (!response.ok) return empty;
    const payload = (await response.json()) as ApiResponse<PublicBundleFacets>;
    return payload.status === "success" ? { brands: [], ...payload.data } : empty;
  } catch {
    return empty;
  }
}

export { getKit, getKitAvailability, getKitsPage, getKitFacets };
export type { KitLookup };
