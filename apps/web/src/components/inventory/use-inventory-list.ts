import { useCallback, useEffect, useState } from "react";
import type { PaginationMeta, StockStatus } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { InventoryListData, PanelProductRow } from "@/lib/types/admin-inventory";

/** Orden que acepta el backend (`PANEL_SORT_FIELDS`); cualquier otro caería
 * a `name` en silencio. */
type InventorySort = "name" | "totalAvailable" | "-updatedAt";

interface InventoryListFilters {
  search: string;
  status: StockStatus | null;
  sort: InventorySort;
  /** Raíz o subcategoría: el backend incluye a las hijas de una raíz. */
  categoryId?: string;
  limit: number;
}

/**
 * Una página de `GET /admin/inventory`, mismo patrón que
 * `use-shipment-queue.ts` (Milestone 2.4): el ajuste de página al cambiar
 * filtros ocurre DURANTE el render, el `setState` solo vive en callbacks de
 * promesa, y `refreshSignal` lo comparten todos los grupos montados porque
 * un ajuste de stock puede cambiar el estado de un producto (y con él los
 * conteos de su grupo).
 */
function useInventoryList(filters: InventoryListFilters, refreshSignal = 0) {
  const filtersKey = [filters.search, filters.status ?? "", filters.sort, filters.categoryId ?? ""].join("|");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PanelProductRow[] | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<StockStatus, number> | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const fetchPage = useCallback(() => {
    return apiRequest<InventoryListData, PaginationMeta>("/api/v1/admin/inventory", {
      authenticated: true,
      query: {
        page,
        limit: filters.limit,
        sort: filters.sort,
        search: filters.search || undefined,
        status: filters.status ?? undefined,
        categoryId: filters.categoryId,
      },
    });
  }, [page, filters.limit, filters.sort, filters.search, filters.status, filters.categoryId]);

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then((response) => {
        if (cancelled) return;
        if (response.data.items.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setItems(response.data.items);
        setStatusCounts(response.data.statusCounts);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el inventario.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page, refreshSignal]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { items, statusCounts, meta, page, setPage, loadError, retry };
}

export { useInventoryList };
export type { InventorySort, InventoryListFilters };
