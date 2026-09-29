import { useCallback, useEffect, useState } from "react";
import type { OverviewRange } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

interface SalesBucket {
  start: string;
  storeRevenueCents: number;
  orderCount: number;
  subscriptionRevenueCents: number;
}

interface SalesTotals {
  storeRevenueCents: number;
  orderCount: number;
  subscriptionRevenueCents: number;
}

interface SalesSeries {
  range: OverviewRange;
  buckets: SalesBucket[];
  totals: SalesTotals;
  previousTotals: SalesTotals;
}

/**
 * `GET /admin/overview/sales` (Milestone 2.9). Al cambiar `range` conserva
 * la serie anterior con `isRefreshing` — mismo patrón que
 * `use-top-customers.ts` — así el eje y las barras no parpadean a vacío
 * mientras llega el nuevo rango.
 */
function useSalesSeries(range: OverviewRange) {
  const [series, setSeries] = useState<SalesSeries | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const requestKey = `${range}:${retryKey}`;
  const [trackedKey, setTrackedKey] = useState(requestKey);
  if (requestKey !== trackedKey) {
    setTrackedKey(requestKey);
    setIsRefreshing(true);
  }

  useEffect(() => {
    let cancelled = false;
    apiRequest<SalesSeries>("/api/v1/admin/overview/sales", { authenticated: true, query: { range } })
      .then((response) => {
        if (cancelled) return;
        setSeries(response.data);
        setLoadError(null);
        setIsRefreshing(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar la serie de ventas.");
        setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { series, isRefreshing, loadError, retry };
}

export { useSalesSeries };
export type { SalesBucket, SalesSeries, SalesTotals };
