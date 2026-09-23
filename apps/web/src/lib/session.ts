import "server-only";
import { cookies } from "next/headers";
import type { ApiSuccessResponse, PublicUser, UserCapabilities } from "@esencia-glow/shared";
import { API_URL } from "./config";

interface Session {
  user: PublicUser;
  capabilities: UserCapabilities;
}

/**
 * Guard de sesión server-side (FRONTEND_GUIDELINES.md §2): valida contra el
 * backend con `cache: "no-store"`, nunca confía solo en que la cookie exista
 * — una cookie presente no prueba una sesión válida (pudo expirar, revocarse
 * con logout-all, etc.).
 *
 * IMPORTANTE — dominio de la cookie: esto reenvía manualmente el header
 * `cookie` a la API en vez de depender del navegador, porque esta llamada
 * corre en el SERVIDOR de Next, no en el navegador del operador. Solo
 * funciona si el `access_token` llega a `cookies()` de este servidor, lo que
 * en producción requiere `COOKIE_DOMAIN` en la API (ver la nota en
 * apps/api/src/config/env.ts) — front y API en el mismo dominio registrable.
 */
async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) return null;

  // La API caída/inalcanzable (deploy en curso, blip de red) no debe tirar
  // este Server Component — se trata igual que "sin sesión válida": el guard
  // manda a /login en vez de reventar con la página de error genérica de
  // Next (code review, Milestone 2.1).
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { cookie: `access_token=${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as ApiSuccessResponse<Session> | null;
  if (!payload || payload.status !== "success") return null;

  return payload.data;
}

export type { Session };
export { getSession };
