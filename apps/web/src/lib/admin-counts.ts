import type { PaginationMeta } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";

/**
 * Total de un listado admin sin traer filas: `limit: 1` y se lee `meta.total`.
 * Lo comparten el Resumen y la campana de pendientes del panel.
 */
async function fetchTotal(path: string, query: Record<string, string | number | boolean>): Promise<number> {
  const response = await apiRequest<unknown[], PaginationMeta>(path, {
    authenticated: true,
    query: { ...query, page: 1, limit: 1 },
  });
  return response.meta?.total ?? 0;
}

export { fetchTotal };
