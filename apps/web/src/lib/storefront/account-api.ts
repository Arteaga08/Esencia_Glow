import type { ApiSuccessResponse } from "@esencia-glow/shared";
import { ApiRequestError, apiRequest, type QueryParams } from "../api";
import { clearAnonymous } from "./session-hint";

/**
 * Cliente de API de "Mi Cuenta" para el navegador. El access token dura 15
 * minutos: ante un 401 de sesión intenta UN refresco silencioso
 * (`POST /auth/refresh`) y reintenta la llamada. Un 401 con `code` es una
 * respuesta de dominio (p. ej. "la contraseña actual está mal"): se lanza tal
 * cual, no es una sesión vencida.
 *
 * El refresh token es de un solo uso (reusarlo revoca toda la familia), así que
 * el refresco se coordina en dos niveles: dentro de la pestaña, las llamadas
 * simultáneas comparten una sola petición; entre pestañas, un candado
 * (`navigator.locks`) las pone en fila y la que espera, si otra ya renovó la
 * cookie mientras tanto, no refresca otra vez: solo reintenta.
 * Si el refresco falla, la sesión se acabó: se manda a ingresar y se regresa.
 */

const LOCK_NAME = "eg-session-refresh";
const REFRESHED_AT_KEY = "eg-session-refreshed-at";

let refreshInFlight: Promise<boolean> | null = null;

function readRefreshedAt(): number {
  try {
    return Number(window.localStorage.getItem(REFRESHED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeRefreshedAt(): void {
  try {
    window.localStorage.setItem(REFRESHED_AT_KEY, String(Date.now()));
  } catch {
    // Sin almacenamiento: solo se pierde que otra pestaña se entere de este refresco.
  }
}

async function runRefresh(): Promise<boolean> {
  try {
    await apiRequest("/api/v1/auth/refresh", { method: "POST", authenticated: true });
  } catch {
    return false;
  }
  writeRefreshedAt();
  clearAnonymous();
  return true;
}

async function coordinatedRefresh(): Promise<boolean> {
  const askedAt = Date.now();
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return runRefresh();

  return locks.request(LOCK_NAME, async () => {
    // Otra pestaña renovó la cookie mientras esta esperaba el candado: reusar el
    // refresh token viejo revocaría la sesión entera, así que solo se reintenta.
    if (readRefreshedAt() >= askedAt) {
      clearAnonymous();
      return true;
    }
    return runRefresh();
  });
}

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= coordinatedRefresh().finally(() => {
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
   * `false` cuando quien llama decide qué hacer si la sesión no se pudo
   * recuperar (la estrella de guardar vive en una página pública: no debe
   * expulsar a nadie). Por defecto se manda a ingresar.
   */
  redirectOnFailure?: boolean;
}

/** 401 sin `code` = el access token venció (o no hay sesión). */
function isExpiredSession(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.status === 401 && !error.code;
}

async function accountRequest<TData, TMeta = never>(
  path: string,
  { redirectOnFailure = true, ...options }: AccountRequestOptions = {},
): Promise<ApiSuccessResponse<TData, TMeta extends never ? never : TMeta>> {
  try {
    return await apiRequest<TData, TMeta>(path, { ...options, authenticated: true });
  } catch (error) {
    if (!isExpiredSession(error)) throw error;

    if (await refreshSession()) {
      try {
        return await apiRequest<TData, TMeta>(path, { ...options, authenticated: true });
      } catch (retryError) {
        if (!isExpiredSession(retryError)) throw retryError;
      }
    }
    if (redirectOnFailure) goToLogin();
    throw error;
  }
}

export { accountRequest, refreshSession, goToLogin };
export type { AccountRequestOptions };
