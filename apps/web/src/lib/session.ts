import "server-only";
import { cookies } from "next/headers";
import type { ApiSuccessResponse, PublicUser, UserCapabilities } from "@esencia-glow/shared";
import { API_URL } from "./config";
import { internalApiHeaders } from "./server-api";
import { classifyUpstreamStatus } from "./upstream-status";

interface Session {
  user: PublicUser;
  capabilities: UserCapabilities;
}

/**
 * Resultado de validar la sesión. `unavailable` (API saturada, caída, 429) NO es
 * `anonymous`: un guard que mande al login por un 429 le quita la sesión a
 * quien sí la tiene, justo cuando el API está más cargado.
 */
type SessionState = { status: "authenticated"; session: Session } | { status: "anonymous" } | { status: "unavailable" };

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
 *
 * La llamada lleva la IP del visitante (`internalApiHeaders`): así el límite de
 * peticiones del API cuenta por visitante y no por el servidor web.
 */
async function getSessionState(): Promise<SessionState> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) return { status: "anonymous" };

  // La API caída/inalcanzable (deploy en curso, blip de red) no debe tirar
  // este Server Component (code review, Milestone 2.1) ni confundirse con "sin
  // sesión": se devuelve `unavailable` y el guard ofrece reintentar.
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { cookie: `access_token=${accessToken}`, ...(await internalApiHeaders({ visitor: true })) },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }

  const outcome = classifyUpstreamStatus(response.status);
  if (outcome === "unauthorized") return { status: "anonymous" };
  if (outcome !== "ok") return { status: "unavailable" };

  const payload = (await response.json().catch(() => null)) as ApiSuccessResponse<Session> | null;
  if (!payload || payload.status !== "success") return { status: "unavailable" };

  return { status: "authenticated", session: payload.data };
}

/**
 * Para las pantallas que solo cambian si YA hay sesión (login, registro): sin
 * poder confirmarla se comportan como visitante, que es lo seguro.
 */
async function getSession(): Promise<Session | null> {
  const state = await getSessionState();
  return state.status === "authenticated" ? state.session : null;
}

export type { Session, SessionState };
export { getSession, getSessionState };
