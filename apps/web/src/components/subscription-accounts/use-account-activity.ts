import { useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionAccountActivityEntry } from "@/lib/types/admin-subscription";

/** Bitácora de UNA cuenta (`GET /admin/subscriptions/:id/activity`),
 * Milestone 2.7a. `accountId` vacío no dispara ningún fetch. */
function useAccountActivity(accountId: string) {
  const [entries, setEntries] = useState<AdminSubscriptionAccountActivityEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    apiRequest<AdminSubscriptionAccountActivityEntry[]>(`/api/v1/admin/subscriptions/${accountId}/activity`, {
      authenticated: true,
    })
      .then((response) => {
        if (cancelled) return;
        setEntries(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar la bitácora de esta cuenta.");
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return { entries, loadError };
}

export { useAccountActivity };
