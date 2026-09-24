import "server-only";
import { cookies } from "next/headers";
import type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from "@esencia-glow/shared";
import { API_URL } from "./config";
import { buildQueryString, type QueryParams } from "./api";

/**
 * Generaliza el fetch server-side que `getSession()` (lib/session.ts) hacía
 * a mano: reenvía el header `cookie` (esta llamada corre en el servidor de
 * Next, el navegador nunca la ve — no hay `credentials: "include"` posible
 * aquí) y devuelve el mismo contrato `{ status, message, data, meta? }` que
 * `apiRequest` del lado cliente. Pensado para el primer render de un Server
 * Component (ej. la primera página del listado de productos); las mutaciones
 * y refetch tras filtrar/paginar siguen yendo por `apiRequest` en el cliente.
 */
class ServerFetchError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: number, response: ApiErrorResponse) {
    super(response.message);
    this.name = "ServerFetchError";
    this.status = status;
    this.fieldErrors = response.errors;
  }
}

async function fetchServerJson<TData, TMeta = never>(
  path: string,
  query?: QueryParams,
): Promise<ApiSuccessResponse<TData, TMeta extends never ? never : TMeta> | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) return null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${buildQueryString(query)}`, {
      headers: { cookie: `access_token=${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<TData> | null;
  if (!response.ok || !payload || payload.status !== "success") return null;

  return payload as ApiSuccessResponse<TData, TMeta extends never ? never : TMeta>;
}

export { fetchServerJson, ServerFetchError };
