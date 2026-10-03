import { WarningCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { formatMoneyMXN, pesosInputToCents } from "@/lib/format-money";
import { BillingModeSelector } from "./billing-mode-selector";
import { comparePrepaidToMonthly, formatPercent, type PrepaidPeriod } from "./plan-pricing";
import type { PlanFormValue } from "./plan-form-value";

interface PlanPriceFieldsProps {
  value: PlanFormValue;
  onChange: (patch: Partial<PlanFormValue>) => void;
  /** En edición los precios son inmutables (un `Price` de Stripe no cambia
   * nunca, decisión 1 de 1.7.2a): se muestran de solo lectura. */
  locked: boolean;
  errors: Record<string, string>;
}

const COMPARISON_COPY = {
  quarter: "3 mensualidades",
  year: "12 mensualidades",
} as const;

/** "Equivale a $489.00 al mes, 2 % menos que 3 mensualidades" — o la
 * advertencia si el precio prepagado sale más caro. Solo referencia visual. */
function PrepaidComparisonLine({
  price,
  prepaidPrice,
  period,
}: {
  price: string;
  prepaidPrice: string;
  period: PrepaidPeriod;
}) {
  const comparison = comparePrepaidToMonthly(
    pesosInputToCents(price) ?? 0,
    pesosInputToCents(prepaidPrice) ?? 0,
    period,
  );
  if (!comparison) {
    return (
      <p className="text-body-sm text-muted-foreground-strong">
        Escribe ambos precios para ver la equivalencia mensual.
      </p>
    );
  }
  const equivalent = `Equivale a ${formatMoneyMXN(comparison.monthlyEquivalentCents)} al mes`;
  if (comparison.savingsPercent < 0) {
    return (
      <p className="flex items-start gap-1.5 text-body-sm text-destructive-action">
        <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        {equivalent}: {formatPercent(comparison.savingsPercent)} más caro que pagar{" "}
        {COMPARISON_COPY[period]} ({formatMoneyMXN(comparison.fullMonthlyCents)}).
      </p>
    );
  }
  return (
    <p className="text-body-sm text-muted-foreground-strong">
      {equivalent}, {formatPercent(comparison.savingsPercent)} menos que{" "}
      {COMPARISON_COPY[period]} ({formatMoneyMXN(comparison.fullMonthlyCents)}).
    </p>
  );
}

function PlanPriceFields({ value, onChange, locked, errors }: PlanPriceFieldsProps) {
  if (locked) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Precio mensual (MXN)" value={value.price} readOnly />
          <Input
            label="Precio trimestral (MXN)"
            value={value.offersQuarterly ? value.quarterlyPrice : "Sin cobro trimestral"}
            readOnly
          />
          <Input
            label="Precio anual (MXN)"
            value={value.offersAnnual ? value.annualPrice : "Sin cobro anual"}
            readOnly
          />
        </div>
        {value.offersQuarterly ? (
          <PrepaidComparisonLine
            price={value.price}
            prepaidPrice={value.quarterlyPrice}
            period="quarter"
          />
        ) : null}
        {value.offersAnnual ? (
          <PrepaidComparisonLine price={value.price} prepaidPrice={value.annualPrice} period="year" />
        ) : null}
        <p className="text-body-sm text-muted-foreground-strong">
          Los precios quedan fijos al crear el plan. Para cambiarlos, crea un plan nuevo y desactiva
          este.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BillingModeSelector value={value} onChange={onChange} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Precio mensual (MXN)"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder="499.00"
          value={value.price}
          onChange={(e) => onChange({ price: e.target.value })}
          error={errors.priceCents}
        />
        {value.offersQuarterly ? (
          <Input
            label="Precio trimestral (MXN)"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="1467.00"
            value={value.quarterlyPrice}
            onChange={(e) => onChange({ quarterlyPrice: e.target.value })}
            error={errors.quarterlyPriceCents}
          />
        ) : null}
        {value.offersAnnual ? (
          <Input
            label="Precio anual (MXN)"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="5748.00"
            value={value.annualPrice}
            onChange={(e) => onChange({ annualPrice: e.target.value })}
            error={errors.annualPriceCents}
          />
        ) : null}
      </div>
      {value.offersQuarterly ? (
        <PrepaidComparisonLine
          price={value.price}
          prepaidPrice={value.quarterlyPrice}
          period="quarter"
        />
      ) : null}
      {value.offersAnnual ? (
        <PrepaidComparisonLine price={value.price} prepaidPrice={value.annualPrice} period="year" />
      ) : null}
      <p className="text-body-sm text-muted-foreground-strong">
        Revisa bien los precios: después de crear el plan ya no se pueden cambiar.
      </p>
    </div>
  );
}

export { PlanPriceFields };
