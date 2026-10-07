import { ErrorState } from "@/components/ui/error-state";
import type { BreakdownRow } from "./status-breakdown-bars";
import { SnapshotBreakdownCard } from "./snapshot-breakdown-card";
import { useOverviewSnapshot, type OverviewSnapshot } from "./use-overview-snapshot";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

/** Arma las 4 tarjetas de foto del Resumen a partir de un solo snapshot
 * compuesto (Milestone 2.9) — cada renglón enlaza a su sección ya
 * filtrada. */
function buildOrderRows(snapshot: OverviewSnapshot): BreakdownRow[] {
  return [
    { key: "action", label: "Pendientes", value: snapshot.orderGroups.action, href: `${ADMIN_ROUTES.orders}?group=action`, tone: "warning" },
    { key: "progress", label: "Pagos", value: snapshot.orderGroups.progress, href: `${ADMIN_ROUTES.orders}?group=progress` },
    { key: "shipping", label: "Envíos", value: snapshot.orderGroups.shipping, href: `${ADMIN_ROUTES.orders}?group=shipping` },
    { key: "problems", label: "Problemas", value: snapshot.orderGroups.problems, href: `${ADMIN_ROUTES.orders}?group=problems`, tone: "critical" },
  ];
}

function buildShipmentRows(snapshot: OverviewSnapshot): BreakdownRow[] {
  return [
    {
      key: "problems",
      label: "Requieren atención",
      value: snapshot.shipmentQueues.problems,
      href: `${ADMIN_ROUTES.shipments}?channel=store&queue=problems`,
      tone: "critical",
    },
    { key: "paid", label: "Pagados, por preparar", value: snapshot.shipmentQueues.paid, href: `${ADMIN_ROUTES.shipments}?channel=store&queue=paid` },
    { key: "preparing", label: "En preparación", value: snapshot.shipmentQueues.preparing, href: `${ADMIN_ROUTES.shipments}?channel=store&queue=preparing` },
    { key: "transit", label: "En camino", value: snapshot.shipmentQueues.transit, href: `${ADMIN_ROUTES.shipments}?channel=store&queue=transit` },
    { key: "delivered", label: "Entregadas", value: snapshot.shipmentQueues.delivered, href: `${ADMIN_ROUTES.shipments}?channel=store&queue=delivered`, tone: "good" },
    {
      key: "sub-incidents",
      label: "Cajas con incidencia",
      value: snapshot.subscriptionShipmentIncidents,
      href: `${ADMIN_ROUTES.shipments}?channel=subscription&queue=incidents`,
      tone: "critical",
    },
  ];
}

function buildInventoryRows(snapshot: OverviewSnapshot): BreakdownRow[] {
  return [
    { key: "out", label: "Agotado", value: snapshot.inventory.out, href: `${ADMIN_ROUTES.inventory}?status=out`, tone: "critical" },
    { key: "low", label: "Stock bajo", value: snapshot.inventory.low, href: `${ADMIN_ROUTES.inventory}?status=low`, tone: "warning" },
  ];
}

function buildSubscriptionRows(snapshot: OverviewSnapshot): BreakdownRow[] {
  return [
    { key: "active", label: "Activas", value: snapshot.subscriptions.active, href: `${ADMIN_ROUTES.accounts}?status=active`, tone: "good" },
    { key: "past_due", label: "Cobro fallido", value: snapshot.subscriptions.pastDue, href: `${ADMIN_ROUTES.accounts}?status=past_due`, tone: "critical" },
    { key: "attention", label: "En riesgo", value: snapshot.subscriptions.attention, href: `${ADMIN_ROUTES.accounts}?attention=true`, tone: "warning" },
    { key: "paused", label: "Pausadas", value: snapshot.subscriptions.paused, href: `${ADMIN_ROUTES.accounts}?status=paused` },
    { key: "incomplete", label: "Incompletas", value: snapshot.subscriptions.incomplete, href: `${ADMIN_ROUTES.accounts}?status=incomplete` },
  ];
}

interface OverviewSnapshotCardsResult {
  loadError: string | null;
  retry: () => void;
  orders: BreakdownRow[] | null;
  shipments: BreakdownRow[] | null;
  inventory: BreakdownRow[] | null;
  subscriptions: BreakdownRow[] | null;
}

function useOverviewSnapshotCards(): OverviewSnapshotCardsResult {
  const { snapshot, loadError, retry } = useOverviewSnapshot();
  return {
    loadError,
    retry,
    orders: snapshot ? buildOrderRows(snapshot) : null,
    shipments: snapshot ? buildShipmentRows(snapshot) : null,
    inventory: snapshot ? buildInventoryRows(snapshot) : null,
    subscriptions: snapshot ? buildSubscriptionRows(snapshot) : null,
  };
}

/** Las 4 tarjetas de foto, en el orden fijo Pedidos → Envíos → Inventario →
 * Suscripciones — el layout (grilla, columna) lo decide cada página que las
 * monta. */
function OverviewSnapshotCards() {
  const { loadError, retry, orders, shipments, inventory, subscriptions } = useOverviewSnapshotCards();

  if (loadError) {
    return <ErrorState description={loadError} onRetry={retry} />;
  }

  return (
    <>
      <SnapshotBreakdownCard title="Pedidos" description="Compras de tienda por etapa." rows={orders} />
      <SnapshotBreakdownCard title="Envíos" description="Guías y cajas por cola de trabajo." rows={shipments} />
      <SnapshotBreakdownCard title="Inventario" description="Variantes que necesitan reabasto." rows={inventory} />
      <SnapshotBreakdownCard title="Suscripciones" description="Cuentas por estatus." rows={subscriptions} />
    </>
  );
}

export { OverviewSnapshotCards };
