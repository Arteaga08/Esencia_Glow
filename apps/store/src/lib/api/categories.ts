import "server-only";
import type { ApiResponse, PublicCategoryNode } from "@esencia-glow/shared";
import { API_URL } from "../config";

// El árbol cambia poco (lo edita Manuel desde el panel): cinco minutos de
// caché evitan una llamada al API por cada navegación.
const CATEGORY_TREE_REVALIDATE_SECONDS = 300;

/**
 * Árbol público de categorías para el navbar. Si el API no responde
 * devuelve `[]`: el header sigue funcionando (logo, Ofertas, acciones) en
 * vez de tumbar toda la tienda por un menú.
 */
async function getCategoryTree(): Promise<PublicCategoryNode[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/categories`, {
      next: { revalidate: CATEGORY_TREE_REVALIDATE_SECONDS },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as ApiResponse<PublicCategoryNode[]>;
    return payload.status === "success" ? payload.data : [];
  } catch {
    return [];
  }
}

export { getCategoryTree };
