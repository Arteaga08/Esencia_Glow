import { useCallback, useEffect, useState } from "react";
import type { PaginationMeta, ReservationStatus } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminReservation } from "@/lib/types/admin-inventory";

const RESERVATION_PAGE_LIMIT = 10;

/**
 * Una página de `GET /admin/inventory/reservations` con `status` fijo: cada
 * estado es su propia cola, y el conteo del encabezado es el `meta.total`
 * de esta misma consulta (el endpoint no devuelve conteos por estado). A
 * diferencia de `GET /admin/inventory`, aquí `data` sí es un array plano.
 * `refreshSignal` lo comparten las tres colas: liberar mueve una reserva de
 * Activos a Liberados, y la cola destino ya montada tiene que enterarse.
 */
function useReservationQueue(status: ReservationStatus, refreshSignal = 0) {
  const [page, setPage] = useState(1);
  const [reservations, setReservations] = useState<AdminReservation[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const fetchPage = useCallback(() => {
    return apiRequest<AdminReservation[], PaginationMeta>("/api/v1/admin/inventory/reservations", {
      authenticated: true,
      query: { status, page, limit: RESERVATION_PAGE_LIMIT, sort: "-createdAt" },
    });
  }, [status, page]);

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then((response) => {
        if (cancelled) return;
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setReservations(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar los apartados.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page, refreshSignal]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { reservations, meta, page, setPage, loadError, retry };
}

export { useReservationQueue };
