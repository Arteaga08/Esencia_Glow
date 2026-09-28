import { useCallback, useEffect, useState } from "react";
import type { PaginationMeta, SubscriptionStatus } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionAccountListItem } from "@/lib/types/admin-subscription";

const SUBSCRIPTION_ACCOUNT_PAGE_LIMIT = 20;

interface SubscriptionAccountFilters {
  search: string;
  status: SubscriptionStatus | null;
  planId: string | null;
  /** Atajo "Requiere atención" — EXCLUYENTE de `status` en el backend
   * (`.oxor`, ver subscription-account-admin.validator.ts). La página nunca
   * manda ambos a la vez. */
  attention: boolean;
}

/**
 * Una página de `GET /admin/subscriptions` (Milestone 2.7a) — calcado de
 * `use-customer-list.ts`: reset de página durante el render cuando cambian
 * los filtros (nunca en un efecto), `fetchPage` memoizado, `retryKey` para
 * reintentar sin duplicar lógica de carga.
 */
function useSubscriptionAccountList(filters: SubscriptionAccountFilters) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminSubscriptionAccountListItem[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Patrón "adjusting state when a prop changes" de React (react.dev) —
  // ajusta el estado DURANTE el render, no en un efecto, mismo criterio que
  // `use-order-group.ts`.
  const filterKey = `${filters.search}|${filters.status ?? ""}|${filters.planId ?? ""}|${filters.attention}`;
  const [trackedFilterKey, setTrackedFilterKey] = useState(filterKey);
  if (filterKey !== trackedFilterKey) {
    setTrackedFilterKey(filterKey);
    setPage(1);
  }

  const fetchPage = useCallback(() => {
    return apiRequest<AdminSubscriptionAccountListItem[], PaginationMeta>("/api/v1/admin/subscriptions", {
      authenticated: true,
      query: {
        page,
        limit: SUBSCRIPTION_ACCOUNT_PAGE_LIMIT,
        search: filters.search || undefined,
        status: filters.status ?? undefined,
        planId: filters.planId ?? undefined,
        attention: filters.attention || undefined,
      },
    });
  }, [page, filters.search, filters.status, filters.planId, filters.attention]);

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then((response) => {
        if (cancelled) return;
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setItems(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar las cuentas de suscripción.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { items, meta, page, setPage, loadError, retry };
}

export { useSubscriptionAccountList };
export type { SubscriptionAccountFilters };
