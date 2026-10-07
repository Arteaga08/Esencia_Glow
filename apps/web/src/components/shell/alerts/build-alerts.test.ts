import { describe, expect, it } from "vitest";
import { buildAlertRows, totalAlerts, type AlertCounts } from "./build-alerts";

const ZERO: AlertCounts = {
  ordersAction: 0,
  ordersProblems: 0,
  shipmentProblems: 0,
  shipmentsToPrepare: 0,
  subscriptionShipmentIncidents: 0,
  stockOut: 0,
  stockLow: 0,
  subscriptionsPastDue: 0,
  subscriptionsAtRisk: 0,
};

describe("buildAlertRows", () => {
  it("sin pendientes no hay renglones", () => {
    expect(buildAlertRows(ZERO)).toEqual([]);
    expect(totalAlerts([])).toBe(0);
  });

  it("omite los conteos en cero y usa singular o plural", () => {
    const rows = buildAlertRows({ ...ZERO, ordersAction: 1, stockLow: 4 });
    expect(rows.map((row) => row.text)).toEqual(["1 pedido pendiente", "4 productos con stock bajo"]);
  });

  it("ordena lo crítico antes que lo que solo espera acción", () => {
    const rows = buildAlertRows({ ...ZERO, ordersAction: 9, stockOut: 2, shipmentsToPrepare: 3, ordersProblems: 1 });
    expect(rows.map((row) => row.key)).toEqual(["ordersProblems", "stockOut", "ordersAction", "shipmentsToPrepare"]);
    expect(rows.map((row) => row.tone)).toEqual(["critical", "critical", "warning", "warning"]);
  });

  it("totalAlerts suma los conteos mostrados", () => {
    expect(totalAlerts(buildAlertRows({ ...ZERO, ordersAction: 2, stockOut: 5 }))).toBe(7);
  });

  it("los enlaces llevan la sección ya filtrada", () => {
    const [row] = buildAlertRows({ ...ZERO, subscriptionsPastDue: 1 });
    expect(row?.href).toBe("/admin/subscriptions/accounts?status=past_due");
  });
});
