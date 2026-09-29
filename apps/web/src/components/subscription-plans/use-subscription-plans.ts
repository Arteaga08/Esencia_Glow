import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";

/** Tope del backend (`parseListQuery`, MAX_LIMIT=100): el catálogo de planes
 * es corto por naturaleza (un puñado de cajas), así que se trae completo en
 * una sola página, igual que `usePlanFilterOptions` de Cuentas. */
const PLAN_LIST_LIMIT = 100;

/**
 * Todos los planes (activos e inactivos), en el orden manual del catálogo
 * (`sortOrder`).
 * volver a pedir la lista completa.
 */
function useSubscriptionPlans() {
  const [plans, setPlans] = useState<AdminSubscriptionPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminSubscriptionPlan[]>("/api/v1/admin/subscription-plans", {
      authenticated: true,
      query: { limit: PLAN_LIST_LIMIT, sort: "sortOrder" },
    })
      .then((response) => {
        if (cancelled) return;
        setPlans(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError ? error.message : "No pudimos cargar los planes.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { plans, loadError, retry };
}

export { useSubscriptionPlans };
