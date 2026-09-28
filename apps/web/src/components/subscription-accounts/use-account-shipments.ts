import { useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionShipment } from "@/lib/types/admin-subscription";

/**
 * Cajas de UNA cuenta (`GET /admin/subscription-shipments?accountId=…`),
 * Milestone 2.7a — reusa el panel de envíos existente en vez de un
 * endpoint propio, mismo criterio que `use-customer-orders.ts` con
 * `?customerId=`. `accountId` vacío no dispara ningún fetch: sin esta
 * guardia pediría TODAS las cajas de TODAS las cuentas en vez de ninguna.
 */
function useAccountShipments(accountId: string) {
  const [shipments, setShipments] = useState<AdminSubscriptionShipment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    apiRequest<AdminSubscriptionShipment[]>("/api/v1/admin/subscription-shipments", {
      authenticated: true,
      query: { accountId, limit: 50, sort: "-createdAt" },
    })
      .then((response) => {
        if (cancelled) return;
        setShipments(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar las cajas de esta cuenta.");
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return { shipments, loadError };
}

export { useAccountShipments };
