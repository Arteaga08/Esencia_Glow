import { useCallback, useEffect, useState } from "react";
import type { EditionStatus } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionEdition } from "@/lib/types/admin-subscription";

/** Tope del backend (`parseListQuery`, MAX_LIMIT=100). Con 3 planes eso
 * cubre más de dos años de ciclos; el filtro por año acota el resto. */
const EDITION_LIST_LIMIT = 100;

interface SubscriptionEditionFilters {
  planId: string | null;
  status: EditionStatus | null;
  cycleYear: number | null;
}

/**
 * Ediciones de `GET /admin/subscription-editions` con los filtros que el
 * backend ya acepta (subscription-query.validator.ts).
 */
function useSubscriptionEditions(filters: SubscriptionEditionFilters) {
  const [editions, setEditions] = useState<AdminSubscriptionEdition[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminSubscriptionEdition[]>("/api/v1/admin/subscription-editions", {
      authenticated: true,
      query: {
        limit: EDITION_LIST_LIMIT,
        sort: "-cycleYear",
        planId: filters.planId ?? undefined,
        status: filters.status ?? undefined,
        cycleYear: filters.cycleYear ?? undefined,
      },
    })
      .then((response) => {
        if (cancelled) return;
        setEditions(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError ? error.message : "No pudimos cargar las ediciones.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [filters.planId, filters.status, filters.cycleYear, retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { editions, loadError, retry };
}

/** Orden de lectura del panel: ciclo más reciente arriba. El backend solo
 * ordena por UN campo (`resolveSort`), así que año+mes se ordena aquí. */
function sortByCycleDesc(editions: AdminSubscriptionEdition[]): AdminSubscriptionEdition[] {
  return [...editions].sort((a, b) => b.cycleYear - a.cycleYear || b.cycleMonth - a.cycleMonth);
}

export { useSubscriptionEditions, sortByCycleDesc };
export type { SubscriptionEditionFilters };
