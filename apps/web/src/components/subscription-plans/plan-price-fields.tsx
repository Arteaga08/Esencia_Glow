import { WarningCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { formatMoneyMXN, pesosInputToCents } from "@/lib/format-money";
import { BillingModeSelector } from "./billing-mode-selector";
import { compareAnnualToMonthly, formatPercent } from "./plan-pricing";
import type { PlanFormValue } from "./plan-form-value";

interface PlanPriceFieldsProps {
  value: PlanFormValue;
  onChange: (patch: Partial<PlanFormValue>) => void;
  /** En edición los precios son inmutables (un `Price` de Stripe no cambia
   * nunca, decisión 1 de 1.7.2a): se muestran de solo lectura. */
  locked: boolean;
  errors: Record<string, string>;
}

/** "Equivale a $332.50 al mes, 16.7 % menos que 12 mensualidades" — o la
 * advertencia si el anual sale más caro. Solo referencia visual. */
function AnnualComparisonLine({ price, annualPrice }: { price: string; annualPrice: string }) {
  const comparison = compareAnnualToMonthly(
    pesosInputToCents(price) ?? 0,
    pesosInputToCents(annualPrice) ?? 0,
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
        {equivalent}: {formatPercent(comparison.savingsPercent)} más caro que pagar 12 meses (
        {formatMoneyMXN(comparison.twelveMonthlyCents)}).
      </p>
    );
  }
  return (
    <p className="text-body-sm text-muted-foreground-strong">
      {equivalent}, {formatPercent(comparison.savingsPercent)} menos que 12 mensualidades (
      {formatMoneyMXN(comparison.twelveMonthlyCents)}).
    </p>
  );
}

function PlanPriceFields({ value, onChange, locked, errors }: PlanPriceFieldsProps) {
  const annual = value.billingMode === "monthly_and_annual";

  if (locked) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Precio mensual (MXN)" value={value.price} readOnly />
          <Input
            label="Precio anual (MXN)"
            value={annual ? value.annualPrice : "Sin cobro anual"}
            readOnly
          />
        </div>
        {annual ? (
          <AnnualComparisonLine price={value.price} annualPrice={value.annualPrice} />
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
      <BillingModeSelector
        value={value.billingMode}
        onChange={(billingMode) => onChange({ billingMode })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Precio mensual (MXN)"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder="399.00"
          value={value.price}
          onChange={(e) => onChange({ price: e.target.value })}
          error={errors.priceCents}
        />
        {annual ? (
          <Input
            label="Precio anual (MXN)"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="3990.00"
            value={value.annualPrice}
            onChange={(e) => onChange({ annualPrice: e.target.value })}
            error={errors.annualPriceCents}
          />
        ) : null}
      </div>
      {annual ? <AnnualComparisonLine price={value.price} annualPrice={value.annualPrice} /> : null}
      <p className="text-body-sm text-muted-foreground-strong">
        Revisa bien los precios: después de crear el plan ya no se pueden cambiar.
      </p>
    </div>
  );
}

export { PlanPriceFields };
