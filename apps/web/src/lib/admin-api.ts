import type { ApiSuccessResponse } from "@esencia-glow/shared";
import { ADMIN_LOGIN_PATH } from "./admin-routes";
import { ApiRequestError, apiRequest as baseApiRequest, buildQueryString } from "./api";
import type { QueryParams, QueryValue } from "./api";
import { accountRequest } from "./storefront/account-api";

type AdminRequestOptions = NonNullable<Parameters<typeof baseApiRequest>[1]>;

/**
 * Cliente de API del panel. El access token dura 15 minutos y el panel hace
 * consultas desde el navegador (filtros, contador de alertas, guardados): con
 * `apiRequest` a secas, la primera que llegaba con el token vencido fallaba con
 * "No autenticado" y "Reintentar" repetía la misma llamada con la misma cookie
 * vencida, así que la única salida era cerrar sesión y volver a entrar.
 *
 * Las llamadas autenticadas pasan por `accountRequest`: ante un 401 de sesión
 * hacen UN refresco coordinado (entre llamadas y entre pestañas) y reintentan.
 * Si la sesión de verdad se acabó, mandan al login del panel. Mantiene el
 * nombre y la firma de `apiRequest` para que las pantallas solo cambien el
 * origen del import.
 *
 * Las llamadas sin `authenticated` (públicas) y las de `/auth/*` (login,
 * refresh, logout) no deben refrescar nunca: un 401 ahí no es una sesión vencida.
 */
async function apiRequest<TData, TMeta = never>(
  path: string,
  options: AdminRequestOptions = {},
): Promise<ApiSuccessResponse<TData, TMeta extends never ? never : TMeta>> {
  const isAuthRoute = path.startsWith("/api/v1/auth/");
  if (!options.authenticated || isAuthRoute) {
    return baseApiRequest<TData, TMeta>(path, options);
  }
  // `accountRequest` siempre manda las cookies: el flag ya cumplió su función arriba.
  const rest: Omit<AdminRequestOptions, "authenticated"> = { ...options };
  delete (rest as AdminRequestOptions).authenticated;
  return accountRequest<TData, TMeta>(path, { loginPath: ADMIN_LOGIN_PATH, ...rest });
}

export { apiRequest, ApiRequestError, buildQueryString };
export type { QueryParams, QueryValue };
