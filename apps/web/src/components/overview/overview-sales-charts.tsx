import { formatMoneyMXN } from "@/lib/format-money";
import { SalesChartCard } from "./sales-chart-card";
import { CHART_COLORS } from "./chart-colors";

/** Las 3 gráficas de serie, separadas — paleta validada por dataviz, nunca
 * los tokens pastel de DESIGN.md (no pasan el piso de croma del
 * validador). Ver `chart-colors.ts`. */
function OverviewSalesCharts() {
  return (
    <>
      <SalesChartCard
        title="Ventas de la tienda"
        description="Pedidos comprados de verdad, netos de reembolso."
        valueKey="storeRevenueCents"
        color={CHART_COLORS.store}
        formatValue={formatMoneyMXN}
      />
      <SalesChartCard
        title="Ingresos por suscripciones"
        description="Cobros exitosos de cajas mensuales, trimestrales y anuales."
        valueKey="subscriptionRevenueCents"
        color={CHART_COLORS.subscriptions}
        formatValue={formatMoneyMXN}
      />
      <SalesChartCard
        title="Pedidos pagados"
        description="Número de compras, no su monto."
        valueKey="orderCount"
        color={CHART_COLORS.orders}
        formatValue={(value) => String(value)}
      />
    </>
  );
}

export { OverviewSalesCharts };
