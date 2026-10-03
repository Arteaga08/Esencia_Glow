import { formatMoneyMXN } from "@/lib/format-money";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";
import { comparePrepaidToMonthly, formatPercent, type PrepaidPeriod } from "./plan-pricing";

/** Precio mensual del plan, en dato mono. */
function MonthlyPrice({ plan }: { plan: AdminSubscriptionPlan }) {
  return (
    <span className="font-mono text-data tabular-nums text-foreground">
      {formatMoneyMXN(plan.priceCents)}
      <span className="text-muted-foreground-strong"> /mes</span>
    </span>
  );
}

const PERIOD_COPY = {
  quarter: { unit: "/trimestre", missing: "No disponible" },
  year: { unit: "/año", missing: "No disponible" },
} as const;

/** Precio prepagado (trimestral o anual) con su ahorro frente a pagar mes a
 * mes, o "No disponible" cuando el plan no lo ofrece. Un plan viejo creado
 * antes de 2.7b-1/3.1.7b cae aquí también, sin tratamiento especial. */
function PrepaidPrice({ plan, period }: { plan: AdminSubscriptionPlan; period: PrepaidPeriod }) {
  const cents = period === "quarter" ? plan.quarterlyPriceCents : plan.annualPriceCents;
  if (cents === undefined) {
    return (
      <span className="text-body-sm text-muted-foreground-strong">{PERIOD_COPY[period].missing}</span>
    );
  }
  const comparison = comparePrepaidToMonthly(plan.priceCents, cents, period);
  return (
    <span className="inline-flex flex-col items-end">
      <span className="font-mono text-data tabular-nums text-foreground">
        {formatMoneyMXN(cents)}
        <span className="text-muted-foreground-strong"> {PERIOD_COPY[period].unit}</span>
      </span>
      {comparison ? (
        <span
          className={
            "text-body-sm " +
            (comparison.savingsPercent < 0
              ? "text-destructive-action"
              : "text-muted-foreground-strong")
          }
        >
          {comparison.savingsPercent < 0
            ? `${formatPercent(comparison.savingsPercent)} más caro`
            : `${formatPercent(comparison.savingsPercent)} de ahorro`}
        </span>
      ) : null}
    </span>
  );
}

/** "12 / 50" lugares ocupados del cupo. */
function SeatCount({ plan }: { plan: AdminSubscriptionPlan }) {
  return (
    <span className="font-mono text-data tabular-nums text-foreground">
      {plan.seatsTaken}
      <span className="text-muted-foreground-strong"> / {plan.maxActiveSeats}</span>
    </span>
  );
}

export { MonthlyPrice, PrepaidPrice, SeatCount };
