import { useCallback, useEffect, useState } from "react";
import type { AdminCoupon, CouponKind, PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

const COUPON_PAGE_LIMIT = 20;

interface CouponListFilters {
  search: string;
  kind: CouponKind | null;
  status: "active" | "inactive" | null;
}

/**
 * Una página de `GET /admin/coupons` — mismo patrón que
 * `use-customer-list.ts`: el reset de página al cambiar un filtro se hace
 * durante el render (nunca en un efecto) y `retryKey` permite recargar.
 * `replaceItem` actualiza una fila ya cargada (activar/desactivar) sin
 * volver a pedir toda la página.
 */
function useCouponList({ search, kind, status }: CouponListFilters) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminCoupon[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const filtersKey = `${search}|${kind ?? ""}|${status ?? ""}`;
  const [trackedFilters, setTrackedFilters] = useState(filtersKey);
  if (filtersKey !== trackedFilters) {
    setTrackedFilters(filtersKey);
    setPage(1);
  }

  const fetchPage = useCallback(() => {
    return apiRequest<AdminCoupon[], PaginationMeta>("/api/v1/admin/coupons", {
      authenticated: true,
      query: { page, limit: COUPON_PAGE_LIMIT, search: search || undefined, kind: kind ?? undefined, status: status ?? undefined },
    });
  }, [page, search, kind, status]);

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
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar los cupones.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);
  const replaceItem = useCallback(
    (updated: AdminCoupon) => setItems((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? current),
    [],
  );

  return { items, meta, setPage, loadError, retry, replaceItem };
}

export { useCouponList };
