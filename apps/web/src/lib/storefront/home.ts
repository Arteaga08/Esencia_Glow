import "server-only";
import type { ApiResponse, PublicHomeContent } from "@esencia-glow/shared";
import { API_URL } from "../config";

// El contenido del home lo edita Manuel desde el panel: un minuto de caché
// evita pegarle al API en cada visita y aun así se ve rápido un cambio.
const HOME_REVALIDATE_SECONDS = 60;

/**
 * Contenido público del home. Si el API no responde devuelve `null`: cada
 * sección pinta su respaldo en vez de tumbar toda la portada.
 */
async function getHomeContent(): Promise<PublicHomeContent | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/home`, {
      next: { revalidate: HOME_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<PublicHomeContent>;
    return payload.status === "success" ? payload.data : null;
  } catch {
    return null;
  }
}

export { getHomeContent };
