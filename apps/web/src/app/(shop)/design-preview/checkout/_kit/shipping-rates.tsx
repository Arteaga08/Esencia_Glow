"use client";

import type { PublicShippingRate } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { FOCUS, LABEL } from "./cta-styles";
import { CARRIER_NAMES, daysLabel } from "./shipping-labels";

interface ShippingRatesProps {
  rates: PublicShippingRate[];
  selectedId: string;
  onSelect: (rateId: string) => void;
}

/**
 * Opciones de envío como radios nativos ocultos con la tarjeta como control
 * visible (mismo patrón que las presentaciones del producto). Marca la más
 * económica y la más rápida con texto, no solo con color.
 */
function ShippingRates({ rates, selectedId, onSelect }: ShippingRatesProps) {
  const cheapest = rates.reduce((best, rate) => (rate.amountCents < best.amountCents ? rate : best));
  const fastest = rates.reduce((best, rate) => (rate.estimatedDays < best.estimatedDays ? rate : best));

  return (
    <fieldset>
      <legend className={`mb-3 ${LABEL}`}>Opciones de envío</legend>
      <div className="flex flex-col gap-2">
        {rates.map((rate) => {
          const selected = rate.rateId === selectedId;
          return (
            <label
              key={rate.rateId}
              className={`flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3 transition-colors duration-[var(--duration-base)] ease-out-quart has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                selected ? "border-primary-action bg-blush" : "border-border-strong bg-surface hover:bg-muted"
              }`}
            >
              <input type="radio" name="shipping-rate" value={rate.rateId} checked={selected} onChange={() => onSelect(rate.rateId)} className={`sr-only ${FOCUS}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-subtitle text-foreground">
                    {CARRIER_NAMES[rate.carrier]} {rate.service}
                  </span>
                  {rate.rateId === cheapest.rateId ? <Badge color="success">Más económico</Badge> : null}
                  {rate.rateId === fastest.rateId ? <Badge color="neutral">Más rápido</Badge> : null}
                </span>
                <span className="block text-body-sm text-muted-foreground-strong">{daysLabel(rate.estimatedDays)}</span>
              </span>
              <span className="shrink-0 font-mono text-data tabular-nums text-foreground">{formatMoneyMXN(rate.amountCents)}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-body-sm text-muted-foreground-strong">Las tarifas se mantienen vigentes durante 60 minutos.</p>
    </fieldset>
  );
}

export { ShippingRates };
