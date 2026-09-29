import { formatMoneyMXN } from "@/lib/format-money";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";
import { compareAnnualToMonthly, formatPercent } from "./plan-pricing";

/** Precio mensual del plan, en dato mono. */
function MonthlyPrice({ plan }: { plan: AdminSubscriptionPlan }) {
  return (
    <span className="font-mono text-data tabular-nums text-foreground">
      {formatMoneyMXN(plan.priceCents)}
      <span className="text-muted-foreground-strong"> /mes</span>
    </span>
  );
}

/** Precio anual con su ahorro frente a 12 mensualidades, o "Solo mensual"
 * cuando el plan no lo ofrece. Un plan viejo sin `annualPriceCents` (creado
 * antes de 2.7b-1) cae aquí también, sin tratamiento especial. */
function AnnualPrice({ plan }: { plan: AdminSubscriptionPlan }) {
  if (plan.annualPriceCents === undefined) {
    return <span className="text-body-sm text-muted-foreground-strong">Solo mensual</span>;
  }
  const comparison = compareAnnualToMonthly(plan.priceCents, plan.annualPriceCents);
  return (
    <span className="inline-flex flex-col items-end">
      <span className="font-mono text-data tabular-nums text-foreground">
        {formatMoneyMXN(plan.annualPriceCents)}
        <span className="text-muted-foreground-strong"> /año</span>
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

export { MonthlyPrice, AnnualPrice, SeatCount };
