import "server-only";
import type { ApiResponse, PublicBundle, PublicProduct } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { toShelfKit, toShelfProduct, type ShelfItem } from "./shelf-item";

// Un minuto de caché, igual que el home: se ve rápido un cambio del panel.
const SHELF_REVALIDATE_SECONDS = 60;
const SHELF_LIMIT = 12;
// Tarjetas de los bloques Novedades y Kits del home: la rejilla 2×2.
const SPOTLIGHT_LIMIT = 4;

async function fetchList<T>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/${path}`, { next: { revalidate: SHELF_REVALIDATE_SECONDS } });
    if (!response.ok) return [];
    const payload = (await response.json()) as ApiResponse<T[]>;
    return payload.status === "success" ? payload.data : [];
  } catch {
    return [];
  }
}

/** Productos marcados como "Más vendido" (o los más recientes si `onlyBestsellers` es false). */
async function getShelfProducts(onlyBestsellers = true): Promise<ShelfItem[]> {
  const flag = onlyBestsellers ? "&bestseller=true" : "";
  const products = await fetchList<PublicProduct>(`products?limit=${SHELF_LIMIT}${flag}`);
  return products.filter((product) => product.variants.length > 0).map(toShelfProduct);
}

/** Paquetes publicados, los más recientes primero. */
async function getShelfKits(limit = SHELF_LIMIT): Promise<ShelfItem[]> {
  const bundles = await fetchList<PublicBundle>(`bundles?limit=${limit}`);
  return bundles.map(toShelfKit);
}

/** Productos marcados como "Novedad" (el panel permite como máximo `SPOTLIGHT_LIMIT`). */
async function getNewArrivals(): Promise<ShelfItem[]> {
  const products = await fetchList<PublicProduct>(`products?limit=${SPOTLIGHT_LIMIT}&newArrival=true`);
  return products.filter((product) => product.variants.length > 0).map(toShelfProduct);
}

export { getShelfProducts, getShelfKits, getNewArrivals, SPOTLIGHT_LIMIT };
