import "server-only";
import type { ApiResponse, PublicBrand } from "@esencia-glow/shared";
import { API_URL } from "../config";

// Un minuto de caché, igual que el home: se ve rápido un cambio del panel.
const BRANDS_REVALIDATE_SECONDS = 60;

/** Marcas de la cinta del home; vacío si el API no responde (la cinta no se pinta). */
async function getHomeBrands(): Promise<PublicBrand[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/brands`, { next: { revalidate: BRANDS_REVALIDATE_SECONDS } });
    if (!response.ok) return [];
    const payload = (await response.json()) as ApiResponse<PublicBrand[]>;
    return payload.status === "success" ? payload.data : [];
  } catch {
    return [];
  }
}

/** Una marca por su slug; `null` si no existe o el API no responde. */
async function getBrandBySlug(slug: string): Promise<PublicBrand | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/brands/${encodeURIComponent(slug)}`, {
      next: { revalidate: BRANDS_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<PublicBrand>;
    return payload.status === "success" ? payload.data : null;
  } catch {
    return null;
  }
}

export { getHomeBrands, getBrandBySlug };
