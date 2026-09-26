import { useCallback, useEffect, useState } from "react";
import type { AdminOrderTracking } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { OrderActivityEntry } from "./merge-order-timeline";

/**
 * Bitácora (`/activity`) se pide al montar — es la pestaña por default.
 * Rastreo (`/tracking`) es perezoso: solo se pide la primera vez que se
 * abre esa pestaña, y luego queda cacheado. `refreshAll` se llama tras cada
 * escritura exitosa del detalle (una transición de estatus cambia la
 * bitácora al instante).
 */
function useOrderHistory(orderId: string) {
  const [activity, setActivity] = useState<OrderActivityEntry[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<AdminOrderTracking | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingLoaded, setTrackingLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const loadActivity = useCallback(() => {
    return apiRequest<OrderActivityEntry[]>(`/api/v1/admin/orders/${orderId}/activity`, { authenticated: true })
      .then((response) => {
        setActivity(response.data);
        setActivityError(null);
      })
      .catch((error) => {
        setActivityError(error instanceof ApiRequestError ? error.message : "No pudimos cargar la bitácora.");
      });
  }, [orderId]);

  const loadTracking = useCallback(() => {
    return apiRequest<AdminOrderTracking>(`/api/v1/admin/orders/${orderId}/tracking`, { authenticated: true })
      .then((response) => {
        setTracking(response.data);
        setTrackingError(null);
      })
      .catch((error) => {
        setTrackingError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el rastreo.");
      })
      .finally(() => setTrackingLoaded(true));
  }, [orderId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity, retryKey]);

  function ensureTrackingLoaded() {
    if (!trackingLoaded) loadTracking();
  }

  const refreshAll = useCallback(() => {
    setRetryKey((key) => key + 1);
    if (trackingLoaded) loadTracking();
  }, [loadTracking, trackingLoaded]);

  return { activity, activityError, tracking, trackingError, ensureTrackingLoaded, refreshAll };
}

export { useOrderHistory };
