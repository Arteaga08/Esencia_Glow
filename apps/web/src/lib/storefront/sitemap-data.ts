import "server-only";
import type { ApiResponse, PublicBundle, PublicProduct } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { internalApiHeaders } from "../server-api";

// El sitemap se vuelve a armar cada hora: los productos nuevos aparecen sin redesplegar.
const SITEMAP_REVALIDATE_SECONDS = 3600;
// Tope del API (`MAX_LIMIT` en parse-list-query): menos llamadas por sitemap.
const SITEMAP_PAGE_SIZE = 100;
// Freno de seguridad: 50 páginas = 5,000 elementos por tipo, muy por encima del catálogo real.
const SITEMAP_MAX_PAGES = 50;

/**
 * Recorre un listado público paginado y devuelve solo los slugs. Si el API no
 * responde devuelve lo que alcanzó a leer (o `[]`): el sitemap nunca rompe el
 * build ni la página por una caída del API.
 */
async function fetchAllSlugs<TItem extends { slug: string }>(path: string): Promise<string[]> {
  const slugs: string[] = [];
  try {
    const headers = await internalApiHeaders();
    for (let page = 1; page <= SITEMAP_MAX_PAGES; page += 1) {
      const response = await fetch(`${API_URL}${path}?page=${page}&limit=${SITEMAP_PAGE_SIZE}`, {
        headers,
        next: { revalidate: SITEMAP_REVALIDATE_SECONDS },
      });
      if (!response.ok) break;
      const payload = (await response.json()) as ApiResponse<TItem[]>;
      if (payload.status !== "success") break;
      slugs.push(...payload.data.map((item) => item.slug));
      if (!payload.meta || page >= payload.meta.pages) break;
    }
  } catch {
    // Se devuelve lo acumulado.
  }
  return slugs;
}

/** Slugs de los productos publicados. */
function getProductSlugs(): Promise<string[]> {
  return fetchAllSlugs<PublicProduct>("/api/v1/products");
}

/** Slugs de los kits publicados. */
function getKitSlugs(): Promise<string[]> {
  return fetchAllSlugs<PublicBundle>("/api/v1/bundles");
}

export { getKitSlugs, getProductSlugs };
