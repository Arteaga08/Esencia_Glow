import type { ApiSuccessResponse } from "@esencia-glow/shared";
import { ApiRequestError, apiRequest, type QueryParams } from "../api";

/**
 * Cliente de API de "Mi Cuenta" para el navegador. El access token dura 15
 * minutos: ante un 401 intenta UN refresco silencioso (`POST /auth/refresh`) y
 * reintenta la llamada. El refresh token es de un solo uso, así que los
 * refrescos simultáneos comparten una sola petición (si dos salieran a la vez,
 * la segunda reusaría un token ya rotado y la API revocaría toda la sesión).
 * Si el refresco falla, la sesión se acabó: se manda a ingresar y se regresa.
 */

let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= apiRequest("/api/v1/auth/refresh", { method: "POST", authenticated: true })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function goToLogin(): void {
  const here = `${window.location.pathname}${window.location.search}`;
  // Navegación completa a propósito: fuera de React y sin dejar datos autenticados en memoria.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/ingresar?redirect=${encodeURIComponent(here)}`);
}

interface AccountRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: QueryParams;
  /**
   * `false` cuando un 401 de esta ruta NO significa "sesión vencida" (cambiar
   * la contraseña responde 401 si la actual está mal). Ahí el llamador decide.
   */
  refreshOn401?: boolean;
}

async function accountRequest<TData, TMeta = never>(
  path: string,
  { refreshOn401 = true, ...options }: AccountRequestOptions = {},
): Promise<ApiSuccessResponse<TData, TMeta extends never ? never : TMeta>> {
  try {
    return await apiRequest<TData, TMeta>(path, { ...options, authenticated: true });
  } catch (error) {
    const expired = error instanceof ApiRequestError && error.status === 401 && refreshOn401;
    if (!expired) throw error;

    if (await refreshSession()) {
      try {
        return await apiRequest<TData, TMeta>(path, { ...options, authenticated: true });
      } catch (retryError) {
        if (!(retryError instanceof ApiRequestError && retryError.status === 401)) throw retryError;
      }
    }
    goToLogin();
    throw error;
  }
}

export { accountRequest, refreshSession, goToLogin };
export type { AccountRequestOptions };
