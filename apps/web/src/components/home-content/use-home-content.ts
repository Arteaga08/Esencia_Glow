import { useCallback, useEffect, useState } from "react";
import type { AdminHomeContent } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/**
 * Lectura del documento completo `GET /admin/home` (Milestone 1.8). Cada
 * sección del home lleva su propia `version`; `applySection` reemplaza solo la
 * sección indicada con lo que el servidor confirmó, sin tocar las demás.
 */
function useHomeContent() {
  const [content, setContent] = useState<AdminHomeContent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminHomeContent>("/api/v1/admin/home", { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        setContent(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError
            ? error.message
            : "No pudimos cargar el contenido del home.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const refresh = useCallback(() => {
    setContent(null);
    setRetryKey((key) => key + 1);
  }, []);

  const applySection = useCallback(
    <K extends keyof AdminHomeContent>(key: K, section: AdminHomeContent[K]) => {
      setContent((current) => (current ? { ...current, [key]: section } : current));
    },
    [],
  );

  return { content, loadError, refresh, applySection };
}

export { useHomeContent };
