import { useCallback, useEffect, useState } from "react";
import type { PaginationMeta, ShipmentQueue } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminShipmentRow } from "@/lib/types/admin-shipment";

const SECTION_PAGE_LIMIT = 10;

interface ShipmentQueueFilters {
  search: string;
}

/**
 * Una cola de envíos de tienda es su propia página de `/admin/shipments`
 * con `queue` fijo — mismo patrón que `use-order-group.ts` (Milestone 2.3):
 * el conteo del encabezado es el `meta.total` de esta misma consulta, y el
 * ajuste de página al cambiar filtros ocurre DURANTE el render
 * (`trackedFiltersKey`), no en un efecto.
 *
 * `refreshSignal` es la diferencia con Pedidos: aquí las acciones (reintentar
 * guía) SÍ viven en esta pantalla y pueden mover un pedido a otra cola (de
 * `problems` a `preparing`, por ejemplo). Sin esto, la cola de origen se
 * refresca sola pero la cola destino, ya montada, nunca se entera — el
 * pedido desaparecería del panel hasta recargar. El emisor de la señal vive
 * en la pestaña (`store-shipments-tab.tsx`), compartido por las 4 colas.
 */
function useShipmentQueue(queue: ShipmentQueue, filters: ShipmentQueueFilters, refreshSignal = 0) {
  const filtersKey = filters.search;
  const [page, setPage] = useState(1);
  const [shipments, setShipments] = useState<AdminShipmentRow[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const fetchPage = useCallback(() => {
    return apiRequest<AdminShipmentRow[], PaginationMeta>("/api/v1/admin/shipments", {
      authenticated: true,
      query: {
        queue,
        page,
        limit: SECTION_PAGE_LIMIT,
        search: filters.search || undefined,
      },
    });
  }, [queue, page, filters.search]);

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then((response) => {
        if (cancelled) return;
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setShipments(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar estos envíos.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page, refreshSignal]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { shipments, meta, page, setPage, loadError, retry };
}

export { useShipmentQueue };
export type { ShipmentQueueFilters };
