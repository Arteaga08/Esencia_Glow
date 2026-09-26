import { useCallback, useEffect, useState } from "react";
import type { AdminOrder, OrderStatusGroup, PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

const SECTION_PAGE_LIMIT = 10;

interface OrderGroupFilters {
  search: string;
  priority: string | null;
  orderNumber: string;
}

/**
 * Una sección (Pendientes/Pagos/Envíos/Problemas) es su propia página del
 * listado admin, fijando `group` — nunca `status`: el servicio de listado
 * (`order-admin.service.ts`) trata `group` y `status` como alternativas
 * excluyentes (un `else if`), así que combinarlos silenciaría el segundo.
 * El conteo del encabezado es el `meta.total` de esta misma consulta, no
 * `/admin/orders/summary` (que no filtra) — así el número del encabezado
 * SIEMPRE coincide con lo que la sección muestra, con o sin filtros activos.
 */
function useOrderGroup(group: OrderStatusGroup, filters: OrderGroupFilters) {
  const filtersKey = `${filters.search}|${filters.priority ?? ""}|${filters.orderNumber}`;
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Patrón "adjusting state when a prop changes" de React (react.dev) — ajusta
  // el estado DURANTE el render, no en un efecto, así que nunca dispara
  // `react-hooks/set-state-in-effect` ni la cascada que esa regla evita.
  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const fetchPage = useCallback(() => {
    return apiRequest<AdminOrder[], PaginationMeta>("/api/v1/admin/orders", {
      authenticated: true,
      query: {
        group,
        page,
        limit: SECTION_PAGE_LIMIT,
        search: filters.search || undefined,
        priority: filters.priority ?? undefined,
        orderNumber: filters.orderNumber || undefined,
      },
    });
  }, [group, page, filters.search, filters.priority, filters.orderNumber]);

  useEffect(() => {
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
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar estos pedidos.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { orders, meta, page, setPage, loadError, retry };
}

export { useOrderGroup };
export type { OrderGroupFilters };
