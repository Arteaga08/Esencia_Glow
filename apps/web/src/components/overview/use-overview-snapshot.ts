import { useCallback, useEffect, useState } from "react";
import {
  SHIPMENT_QUEUES,
  StockStatus,
  SubscriptionStatus,
  type OrderStatusGroup,
  type PaginationMeta,
} from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/**
 * Foto del momento del Resumen del panel (Milestone 2.9) — composición pura
 * de endpoints que cada módulo YA expone, nunca un endpoint de agregación
 * nuevo (decisión de Manuel: sin backend nuevo para esta parte). Las rutas
 * admin no llevan rate limiting (ver rate-limit.ts), así que una docena de
 * peticiones en paralelo al montar no compite con ninguna cuota.
 *
 * `limit: 1` en cada listado: solo interesa `meta.total`, nunca las filas.
 */

interface ShipmentQueueCounts {
  problems: number;
  paid: number;
  preparing: number;
  transit: number;
  delivered: number;
}

interface SubscriptionStatusCounts {
  incomplete: number;
  active: number;
  pastDue: number;
  paused: number;
  canceled: number;
  attention: number;
}

interface OverviewSnapshot {
  orderGroups: Record<OrderStatusGroup, number>;
  shipmentQueues: ShipmentQueueCounts;
  subscriptionShipmentIncidents: number;
  inventory: { out: number; low: number };
  subscriptions: SubscriptionStatusCounts;
}

async function fetchTotal(path: string, query: Record<string, string | number | boolean>): Promise<number> {
  const response = await apiRequest<unknown[], PaginationMeta>(path, {
    authenticated: true,
    query: { ...query, page: 1, limit: 1 },
  });
  return response.meta?.total ?? 0;
}

async function fetchSnapshot(): Promise<OverviewSnapshot> {
  const [orderGroups, shipmentTotals, subscriptionShipmentIncidents, out, low, subscriptionTotals, attention] =
    await Promise.all([
      apiRequest<Record<OrderStatusGroup, number>>("/api/v1/admin/orders/summary", { authenticated: true }).then(
        (response) => response.data,
      ),
      Promise.all(SHIPMENT_QUEUES.map((queue) => fetchTotal("/api/v1/admin/shipments", { queue }))),
      fetchTotal("/api/v1/admin/subscription-shipments", { incident: true }),
      fetchTotal("/api/v1/admin/inventory", { status: StockStatus.OUT }),
      fetchTotal("/api/v1/admin/inventory", { status: StockStatus.LOW }),
      Promise.all(
        [
          SubscriptionStatus.INCOMPLETE,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
          SubscriptionStatus.CANCELED,
        ].map((status) => fetchTotal("/api/v1/admin/subscriptions", { status })),
      ),
      fetchTotal("/api/v1/admin/subscriptions", { attention: true }),
    ]);

  const [problems, paid, preparing, transit, delivered] = shipmentTotals;
  const [incomplete, active, pastDue, paused, canceled] = subscriptionTotals;

  return {
    orderGroups,
    shipmentQueues: { problems: problems ?? 0, paid: paid ?? 0, preparing: preparing ?? 0, transit: transit ?? 0, delivered: delivered ?? 0 },
    subscriptionShipmentIncidents,
    inventory: { out, low },
    subscriptions: {
      incomplete: incomplete ?? 0,
      active: active ?? 0,
      pastDue: pastDue ?? 0,
      paused: paused ?? 0,
      canceled: canceled ?? 0,
      attention,
    },
  };
}

function useOverviewSnapshot() {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshot()
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el estado del negocio.");
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { snapshot, loadError, retry };
}

export { useOverviewSnapshot };
export type { OverviewSnapshot, ShipmentQueueCounts, SubscriptionStatusCounts };
