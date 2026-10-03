import "server-only";
import type { ApiResponse, PublicSubscriptionPlansResult } from "@esencia-glow/shared";
import { API_URL } from "../config";

// Un minuto de caché, igual que el resto del home.
const PLAN_REVALIDATE_SECONDS = 60;

/**
 * La caja que se ofrece en el home: el primer plan público (la tienda vende
 * una sola caja con varios periodos). Si el API no responde o no hay planes,
 * devuelve `null` y el bloque no se pinta.
 */
async function getFeaturedPlan(): Promise<PublicSubscriptionPlansResult | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/subscription-plans`, {
      next: { revalidate: PLAN_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<PublicSubscriptionPlansResult>;
    if (payload.status !== "success" || payload.data.plans.length === 0) return null;
    return payload.data;
  } catch {
    return null;
  }
}

export { getFeaturedPlan };
