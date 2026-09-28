import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionAccountDetail } from "@/lib/types/admin-subscription";

/**
 * Dueño del `AdminSubscriptionAccountDetail` del detalle (Milestone 2.7a) —
 * calcado de `use-admin-customer.ts`. `accountId` vacío no dispara ningún
 * fetch, mismo criterio de guardia.
 */
function useSubscriptionAccount(accountId: string) {
  const [account, setAccount] = useState<AdminSubscriptionAccountDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    apiRequest<AdminSubscriptionAccountDetail>(`/api/v1/admin/subscriptions/${accountId}`, { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        setAccount(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar la cuenta de suscripción.");
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, retryKey]);

  const refresh = useCallback(() => setRetryKey((key) => key + 1), []);

  return { account, loadError, refresh };
}

export { useSubscriptionAccount };
