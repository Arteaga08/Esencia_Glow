import { ADMIN_ROUTES } from "@/lib/admin-routes";

type AlertTone = "critical" | "warning";

/** Conteos crudos que pide la campana; cada uno ya viene de un listado admin. */
interface AlertCounts {
  ordersAction: number;
  ordersProblems: number;
  shipmentProblems: number;
  shipmentsToPrepare: number;
  subscriptionShipmentIncidents: number;
  stockOut: number;
  stockLow: number;
  subscriptionsPastDue: number;
  subscriptionsAtRisk: number;
}

interface AlertRow {
  key: string;
  count: number;
  /** Texto ya en singular o plural, p. ej. "3 pedidos con problema". */
  text: string;
  href: string;
  tone: AlertTone;
}

interface AlertDefinition {
  key: keyof AlertCounts;
  tone: AlertTone;
  href: string;
  one: string;
  many: string;
}

// El orden de la lista es el orden de gravedad: primero lo crítico, luego lo
// que solo espera acción. Los enlaces son los mismos de las tarjetas del Resumen.
const DEFINITIONS: AlertDefinition[] = [
  { key: "ordersProblems", tone: "critical", href: `${ADMIN_ROUTES.orders}?group=problems`, one: "pedido con problema", many: "pedidos con problema" },
  { key: "shipmentProblems", tone: "critical", href: `${ADMIN_ROUTES.shipments}?channel=store&queue=problems`, one: "envío requiere atención", many: "envíos requieren atención" },
  { key: "subscriptionShipmentIncidents", tone: "critical", href: `${ADMIN_ROUTES.shipments}?channel=subscription&queue=incidents`, one: "caja con incidencia", many: "cajas con incidencia" },
  { key: "subscriptionsPastDue", tone: "critical", href: `${ADMIN_ROUTES.accounts}?status=past_due`, one: "cobro de suscripción fallido", many: "cobros de suscripción fallidos" },
  { key: "stockOut", tone: "critical", href: `${ADMIN_ROUTES.inventory}?status=out`, one: "producto agotado", many: "productos agotados" },
  { key: "ordersAction", tone: "warning", href: `${ADMIN_ROUTES.orders}?group=action`, one: "pedido pendiente", many: "pedidos pendientes" },
  { key: "shipmentsToPrepare", tone: "warning", href: `${ADMIN_ROUTES.shipments}?channel=store&queue=paid`, one: "pedido pagado por preparar", many: "pedidos pagados por preparar" },
  { key: "stockLow", tone: "warning", href: `${ADMIN_ROUTES.inventory}?status=low`, one: "producto con stock bajo", many: "productos con stock bajo" },
  { key: "subscriptionsAtRisk", tone: "warning", href: `${ADMIN_ROUTES.accounts}?attention=true`, one: "suscripción en riesgo", many: "suscripciones en riesgo" },
];

/** Solo los renglones con algo que atender, del más grave al menos grave. */
function buildAlertRows(counts: AlertCounts): AlertRow[] {
  return DEFINITIONS.filter((definition) => counts[definition.key] > 0).map((definition) => {
    const count = counts[definition.key];
    return {
      key: definition.key,
      count,
      text: `${count} ${count === 1 ? definition.one : definition.many}`,
      href: definition.href,
      tone: definition.tone,
    };
  });
}

/** Cuántos pendientes hay en total; es el número de la campana. */
function totalAlerts(rows: AlertRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

export { buildAlertRows, totalAlerts };
export type { AlertCounts, AlertRow, AlertTone };
