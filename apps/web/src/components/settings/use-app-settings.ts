import { useCallback, useEffect, useState } from "react";
import type { AppSettings, CommerceSettings, ShippingSettings } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/**
 * Lectura del singleton completo `GET /admin/settings` (Milestone 2.8),
 * igual que `use-subscription-settings.ts`, pero conserva TODAS las
 * secciones — este hook alimenta el panel de Ajustes, no solo Suscripciones.
 * Settings no tiene control de versión (ver [[esencia-glow-2-8]]): cada
 * mutación reemplaza su sección con exactamente lo que el servidor
 * confirmó, así la pantalla nunca muestra un valor que el backend no
 * aceptó.
 */
function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AppSettings>("/api/v1/admin/settings", { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        setSettings(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar los ajustes.");
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const refresh = useCallback(() => setRetryKey((key) => key + 1), []);

  const updateCommerce = useCallback(async (patch: Partial<CommerceSettings>) => {
    const response = await apiRequest<CommerceSettings>("/api/v1/admin/settings/commerce", {
      authenticated: true,
      method: "PATCH",
      body: patch,
    });
    setSettings((current) => (current ? { ...current, commerce: response.data } : current));
    return response.data;
  }, []);

  const updateShippingOrigin = useCallback(async (origin: Record<string, unknown>) => {
    const response = await apiRequest<ShippingSettings>("/api/v1/admin/settings/shipping", {
      authenticated: true,
      method: "PATCH",
      body: { origin },
    });
    setSettings((current) => (current ? { ...current, shipping: response.data } : current));
    return response.data;
  }, []);

  return { settings, loadError, refresh, updateCommerce, updateShippingOrigin };
}

export { useAppSettings };
