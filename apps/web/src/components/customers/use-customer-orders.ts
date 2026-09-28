import { useCallback, useEffect, useState } from "react";
import type { AdminOrder, PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

const CUSTOMER_ORDERS_PAGE_LIMIT = 10;

/**
 * Pedidos de UN cliente (`GET /admin/orders?customerId=…`), Milestone 2.6 —
 * reusa el listado admin de pedidos existente en vez de un endpoint propio.
 * `customerId` vacío no dispara ningún fetch: `buildQueryString` omite los
 * query params vacíos (lib/api.ts), así que sin esta guardia un
 * `customerId` vacío pediría TODOS los pedidos sin filtrar por cliente en
 * vez de ninguno — mismo criterio que `use-admin-customer.ts`.
 */
function useCustomerOrders(customerId: string) {
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const fetchPage = useCallback(() => {
    return apiRequest<AdminOrder[], PaginationMeta>("/api/v1/admin/orders", {
      authenticated: true,
      query: { customerId, page, limit: CUSTOMER_ORDERS_PAGE_LIMIT, sort: "-createdAt" },
    });
  }, [customerId, page]);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetchPage()
      .then((response) => {
        if (cancelled) return;
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setOrders(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar los pedidos.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page, customerId]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { orders, meta, page, setPage, loadError, retry };
}

export { useCustomerOrders };
