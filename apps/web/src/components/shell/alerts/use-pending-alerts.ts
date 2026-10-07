import { useCallback, useEffect, useState } from "react";
import { StockStatus, SubscriptionStatus, type OrderStatusGroup } from "@esencia-glow/shared";
import { fetchTotal } from "@/lib/admin-counts";
import { apiRequest } from "@/lib/api";
import { buildAlertRows, totalAlerts, type AlertCounts, type AlertRow } from "./build-alerts";

// Mientras la pestaña está visible, la campana se refresca cada 2 minutos.
const REFRESH_MS = 2 * 60 * 1000;

async function fetchAlertCounts(): Promise<AlertCounts> {
  const [
    orderGroups,
    shipmentProblems,
    shipmentsToPrepare,
    subscriptionShipmentIncidents,
    stockOut,
    stockLow,
    subscriptionsPastDue,
    subscriptionsAtRisk,
  ] = await Promise.all([
    apiRequest<Record<OrderStatusGroup, number>>("/api/v1/admin/orders/summary", { authenticated: true }).then(
      (response) => response.data,
    ),
    fetchTotal("/api/v1/admin/shipments", { queue: "problems" }),
    fetchTotal("/api/v1/admin/shipments", { queue: "paid" }),
    fetchTotal("/api/v1/admin/subscription-shipments", { incident: true }),
    fetchTotal("/api/v1/admin/inventory", { status: StockStatus.OUT }),
    fetchTotal("/api/v1/admin/inventory", { status: StockStatus.LOW }),
    fetchTotal("/api/v1/admin/subscriptions", { status: SubscriptionStatus.PAST_DUE }),
    fetchTotal("/api/v1/admin/subscriptions", { attention: true }),
  ]);

  return {
    ordersAction: orderGroups.action,
    ordersProblems: orderGroups.problems,
    shipmentProblems,
    shipmentsToPrepare,
    subscriptionShipmentIncidents,
    stockOut,
    stockLow,
    subscriptionsPastDue,
    subscriptionsAtRisk,
  };
}

interface PendingAlerts {
  /** `null` mientras llega la primera respuesta. */
  rows: AlertRow[] | null;
  total: number;
  failed: boolean;
  refresh: () => void;
}

/**
 * Pendientes del momento para la campana. Se piden al montar, al llamar
 * `refresh` (la campana lo hace al abrirse) y cada 2 minutos si la pestaña
 * está visible. Si una actualización falla se conserva la última lista buena.
 */
function usePendingAlerts(): PendingAlerts {
  const [rows, setRows] = useState<AlertRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAlertCounts()
      .then((counts) => {
        if (cancelled) return;
        setRows(buildAlertRows(counts));
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { rows, total: rows ? totalAlerts(rows) : 0, failed, refresh };
}

export { usePendingAlerts };
