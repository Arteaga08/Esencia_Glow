/**
 * Intervalos de cobro de una suscripción (Milestones 2.7b y 3.1.7b) — módulo
 * puro, sin I/O. "Prepagado" = se cobra por adelantado más de un mes
 * (trimestral y anual): Stripe solo dispara `invoice.paid` una vez por
 * periodo, así que las cajas intermedias las crea un job, y pausar/cambiar de
 * plan no tiene sentido porque el periodo ya está cobrado completo.
 */

type BillingInterval = "month" | "quarter" | "year";
type PrepaidInterval = "quarter" | "year";

/** Meses que cubre un cobro prepagado. */
const PREPAID_INTERVAL_MONTHS: Record<PrepaidInterval, number> = { quarter: 3, year: 12 };

function isPrepaidInterval(interval: BillingInterval | undefined): interval is PrepaidInterval {
  return interval === "quarter" || interval === "year";
}

/** Las cuentas anteriores a 2.7b no traen el campo: se leen como mensuales. */
function normalizeBillingInterval(interval: BillingInterval | undefined): BillingInterval {
  return interval ?? "month";
}

export { PREPAID_INTERVAL_MONTHS, isPrepaidInterval, normalizeBillingInterval };
export type { BillingInterval, PrepaidInterval };
