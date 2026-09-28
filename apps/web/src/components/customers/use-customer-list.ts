import { useCallback, useEffect, useState } from "react";
import type { AdminCustomerListItem, PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

const CUSTOMER_PAGE_LIMIT = 20;

/**
 * Una página de `GET /admin/customers` — mismo patrón que
 * `use-inventory-list.ts`: reset de página durante el render (nunca en un
 * efecto), `fetchPage` memoizado, `retryKey` para reintentar sin duplicar
 * lógica de carga.
 */
function useCustomerList(search: string) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminCustomerListItem[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [trackedSearch, setTrackedSearch] = useState(search);
  if (search !== trackedSearch) {
    setTrackedSearch(search);
    setPage(1);
  }

  const fetchPage = useCallback(() => {
    return apiRequest<AdminCustomerListItem[], PaginationMeta>("/api/v1/admin/customers", {
      authenticated: true,
      query: { page, limit: CUSTOMER_PAGE_LIMIT, search: search || undefined },
    });
  }, [page, search]);

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then((response) => {
        if (cancelled) return;
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setItems(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar los clientes.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { items, meta, page, setPage, loadError, retry };
}

export { useCustomerList };
