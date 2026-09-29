/**
 * Rango de la serie de ventas del Resumen del panel (Milestone 2.9) —
 * ventana MÓVIL, a diferencia de `TopCustomersPeriod` (que es calendario en
 * curso): día = últimas 24 h por hora, semana = últimos 7 días por día, mes
 * = últimos 30 días por día, año = últimos 12 meses por mes. Ver
 * `resolve-overview-window.ts`.
 */
enum OverviewRange {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year",
}

export { OverviewRange };
