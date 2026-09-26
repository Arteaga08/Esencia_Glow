import { useCallback, useEffect, useState } from "react";
import type { AdminOrder } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/** Dueño del `AdminOrder` del detalle. Como toda escritura del backend
 * devuelve el pedido completo releído, "refrescar" tras una acción es
 * literalmente `setOrder(response.data)` — sin Context, sin SWR, sin
 * `router.refresh()`. Mismo patrón `cancelled` + `retryKey` que
 * `use-order-group.ts`. */
function useAdminOrder(orderId: string) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminOrder>(`/api/v1/admin/orders/${orderId}`, { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        setOrder(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el pedido.");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, retryKey]);

  const refresh = useCallback(() => setRetryKey((key) => key + 1), []);

  return { order, setOrder, loadError, refresh };
}

export { useAdminOrder };
