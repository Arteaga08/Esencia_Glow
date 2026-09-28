import { useCallback, useEffect, useState } from "react";
import type { TopCustomersPeriod, TopCustomersResult, TopCustomersSort } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/**
 * Ranking `GET /admin/customers/top` (Milestone 2.6.1). Al cambiar periodo o
 * criterio se conserva el resultado anterior con `isRefreshing` en vez de
 * volver al skeleton: la tabla no parpadea y tampoco finge estar fresca
 * (el componente la atenúa y marca `aria-busy` mientras llega la nueva).
 */
function useTopCustomers(period: TopCustomersPeriod, sortBy: TopCustomersSort) {
  const [result, setResult] = useState<TopCustomersResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [trackedKey, setTrackedKey] = useState(`${period}:${sortBy}:${retryKey}`);
  const requestKey = `${period}:${sortBy}:${retryKey}`;
  if (requestKey !== trackedKey) {
    setTrackedKey(requestKey);
    setIsRefreshing(true);
  }

  useEffect(() => {
    let cancelled = false;
    apiRequest<TopCustomersResult>("/api/v1/admin/customers/top", {
      authenticated: true,
      query: { period, sortBy },
    })
      .then((response) => {
        if (cancelled) return;
        setResult(response.data);
        setLoadError(null);
        setIsRefreshing(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el ranking.");
        setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, sortBy, retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { result, isRefreshing, loadError, retry };
}

export { useTopCustomers };
