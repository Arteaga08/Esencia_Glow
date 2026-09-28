import { useCallback, useEffect, useState } from "react";
import type { AppSettings, SubscriptionSettings } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/**
 * Ventana de inscripciones + día de cobro (Milestone 2.7a) — lectura vía el
 * singleton completo `GET /admin/settings` (nunca un endpoint propio: la
 * sección `subscriptions` ya vive ahí desde 1.7.2a) y las tres mutaciones
 * que la cabecera de Cuentas expone: abrir/cerrar inscripciones (endpoints
 * de ACCIÓN auditable, ver subscription-enrollment.controller.ts) y el
 * `PATCH /admin/settings/subscriptions` que solo toca `billingAnchorDay`.
 */
function useSubscriptionSettings() {
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AppSettings>("/api/v1/admin/settings", { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        setSettings(response.data.subscriptions);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar la ventana de inscripciones.");
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const refresh = useCallback(() => setRetryKey((key) => key + 1), []);

  const openEnrollment = useCallback(async (durationDays?: number) => {
    const response = await apiRequest<SubscriptionSettings>("/api/v1/admin/subscriptions/enrollment/open", {
      authenticated: true,
      method: "POST",
      body: durationDays ? { durationDays } : undefined,
    });
    setSettings(response.data);
  }, []);

  const closeEnrollment = useCallback(async () => {
    const response = await apiRequest<SubscriptionSettings>("/api/v1/admin/subscriptions/enrollment/close", {
      authenticated: true,
      method: "POST",
    });
    setSettings(response.data);
  }, []);

  const updateBillingAnchorDay = useCallback(async (billingAnchorDay: number) => {
    const response = await apiRequest<SubscriptionSettings>("/api/v1/admin/settings/subscriptions", {
      authenticated: true,
      method: "PATCH",
      body: { billingAnchorDay },
    });
    setSettings(response.data);
  }, []);

  return { settings, loadError, refresh, openEnrollment, closeEnrollment, updateBillingAnchorDay };
}

export { useSubscriptionSettings };
