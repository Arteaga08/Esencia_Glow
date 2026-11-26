import "server-only";
import { HOME_CONTENT_LIMITS, type ApiResponse, type PublicBundle, type PublicProduct } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { internalApiHeaders } from "../server-api";
import { toShelfKit, toShelfProduct, type ShelfItem } from "./shelf-item";

// Un minuto de caché, igual que el home: se ve rápido un cambio del panel.
const SHELF_REVALIDATE_SECONDS = 60;
const SHELF_LIMIT = HOME_CONTENT_LIMITS.maxBestsellers;

async function fetchList<T>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/${path}`, { headers: await internalApiHeaders(), next: { revalidate: SHELF_REVALIDATE_SECONDS } });
    if (!response.ok) return [];
    const payload = (await response.json()) as ApiResponse<T[]>;
    return payload.status === "success" ? payload.data : [];
  } catch {
    return [];
  }
}

/**
 * Productos marcados como "Más vendido" (o los más recientes si `onlyBestsellers` es false).
 * El API ordena de más antiguo a más reciente si no se le pide otra cosa, así que
 * se pide `-createdAt` (los fijados al inicio van primero, lo decide el API).
 */
async function getShelfProducts(onlyBestsellers = true): Promise<ShelfItem[]> {
  const flag = onlyBestsellers ? "&bestseller=true" : "";
  const products = await fetchList<PublicProduct>(`products?limit=${SHELF_LIMIT}&sort=-createdAt${flag}`);
  return products.filter((product) => product.variants.length > 0).map(toShelfProduct);
}

/** Paquetes publicados, los más recientes primero. */
async function getShelfKits(limit = SHELF_LIMIT): Promise<ShelfItem[]> {
  const bundles = await fetchList<PublicBundle>(`bundles?limit=${limit}&sort=-createdAt`);
  return bundles.map(toShelfKit);
}

export { getShelfProducts, getShelfKits };
