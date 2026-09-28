import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { ProductInventoryDetail } from "@/lib/types/admin-inventory";

/**
 * Detalle por variante de un producto (`GET /admin/inventory/products/:id`).
 * Solo se monta cuando Manuel abre el producto: la fila del listado es un
 * agregado y el stock se ajusta por variante, así que el `variantId` solo
 * existe aquí.
 */
function useProductInventory(productId: string) {
  const [detail, setDetail] = useState<ProductInventoryDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchDetail = useCallback(() => {
    return apiRequest<ProductInventoryDetail>(`/api/v1/admin/inventory/products/${productId}`, {
      authenticated: true,
    });
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    fetchDetail()
      .then((response) => {
        if (cancelled) return;
        setDetail(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar las variantes.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDetail, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { detail, loadError, reload };
}

export { useProductInventory };
