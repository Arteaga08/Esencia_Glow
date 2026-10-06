import "server-only";
import { cookies } from "next/headers";
import type { ApiResponse, ApiSuccessResponse } from "@esencia-glow/shared";
import { API_URL } from "../config";
import { buildQueryString, type QueryParams } from "../api";

/**
 * Lectura server-side de datos de Mi cuenta. A diferencia de `fetchServerJson`
 * distingue "no existe / no es tuyo" (404) de "no pudimos traerlo" (red, 5xx,
 * sesión vencida entre el layout y esta página): la ficha de un pedido ajeno es
 * un 404, no un "reintentar".
 */
type AccountFetch<TData, TMeta> = { status: "ok"; data: TData; meta?: TMeta } | { status: "notFound" } | { status: "error" };

async function fetchAccountData<TData, TMeta = never>(path: string, query?: QueryParams): Promise<AccountFetch<TData, TMeta>> {
  const accessToken = (await cookies()).get("access_token")?.value;
  if (!accessToken) return { status: "error" };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${buildQueryString(query)}`, { headers: { cookie: `access_token=${accessToken}` }, cache: "no-store" });
  } catch {
    return { status: "error" };
  }

  // 400 = id mal formado: para quien lo escribió a mano es lo mismo que "no existe".
  if (response.status === 404 || response.status === 400) return { status: "notFound" };

  const payload = (await response.json().catch(() => null)) as ApiResponse<TData> | null;
  if (!response.ok || !payload || payload.status !== "success") return { status: "error" };

  const success = payload as ApiSuccessResponse<TData, TMeta>;
  return { status: "ok", data: success.data, meta: success.meta };
}

export { fetchAccountData };
export type { AccountFetch };
