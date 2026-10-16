import "server-only";
import type { ApiResponse, PublicProduct, PublicVariantAvailability } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { internalApiHeaders } from "../server-api";

// Sin caché compartida: la URL la elige quien visita y la llamada lleva su IP (ver `fetch`).

type ProductLookup =
  | { kind: "found"; product: PublicProduct }
  | { kind: "not-found" }
  | { kind: "error" };

/**
 * Producto público por slug. Distingue "no existe" (404 real) de "el API no
 * responde": la primera es una página 404 y la segunda un error reintentable,
 * para que una caída del API no parezca que el producto desapareció.
 */
async function getProduct(slug: string): Promise<ProductLookup> {
  try {
    const response = await fetch(`${API_URL}/api/v1/products/${encodeURIComponent(slug)}`, {
      headers: await internalApiHeaders({ visitor: true }),
      cache: "no-store",
    });
    if (response.status === 404) return { kind: "not-found" };
    if (!response.ok) return { kind: "error" };
    const payload = (await response.json()) as ApiResponse<PublicProduct>;
    return payload.status === "success" ? { kind: "found", product: payload.data } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Disponibilidad por presentación. Si el API no responde devuelve una lista
 * vacía: la página no bloquea la compra por eso, la reserva real decide al pagar.
 */
async function getProductAvailability(slug: string): Promise<PublicVariantAvailability[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/products/${encodeURIComponent(slug)}/availability`, {
      headers: await internalApiHeaders({ visitor: true }),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as ApiResponse<PublicVariantAvailability[]>;
    return payload.status === "success" ? payload.data : [];
  } catch {
    return [];
  }
}

export { getProduct, getProductAvailability };
export type { ProductLookup };
