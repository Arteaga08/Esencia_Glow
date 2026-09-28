import { useCallback, useEffect, useState } from "react";
import type { AdminCustomerDetail } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/**
 * Dueño del `AdminCustomerDetail` del detalle — mismo patrón que
 * `use-admin-order.ts`. `customerId` vacío no dispara ningún fetch: la
 * página de detalle `/customers/[id]` siempre lo tiene poblado desde
 * `useParams`, pero la guardia deja el hook seguro para cualquier otro
 * consumidor futuro que quiera montar el detalle condicionalmente.
 */
function useAdminCustomer(customerId: string) {
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    apiRequest<AdminCustomerDetail>(`/api/v1/admin/customers/${customerId}`, { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        setCustomer(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el cliente.");
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, retryKey]);

  const refresh = useCallback(() => setRetryKey((key) => key + 1), []);

  return { customer, loadError, refresh };
}

export { useAdminCustomer };
