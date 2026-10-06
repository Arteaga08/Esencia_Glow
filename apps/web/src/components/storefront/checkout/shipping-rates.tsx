"use client";

import type { PublicShippingRate } from "@esencia-glow/shared";
import { SHIPPING_CARRIER_LABELS } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { cheapestRate, daysLabel, fastestRate } from "@/lib/storefront/checkout/shipping-labels";
import { FOCUS, LABEL } from "../cart/cta-styles";

interface ShippingRatesProps {
  rates: PublicShippingRate[];
  selectedId: string;
  onSelect: (rateId: string) => void;
  /** Cuándo vence la cotización (ISO): se dice la hora real, no un plazo genérico. */
  expiresAt: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

/**
 * Opciones de envío como radios nativos ocultos con la tarjeta como control
 * visible (mismo patrón que las presentaciones del producto). Marca la más
 * económica y la más rápida con texto, no solo con color.
 */
function ShippingRates({ rates, selectedId, onSelect, expiresAt }: ShippingRatesProps) {
  const cheapest = cheapestRate(rates);
  const fastest = fastestRate(rates);
  // Con una sola opción no hay nada que comparar.
  const compare = rates.length > 1;

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
                    {SHIPPING_CARRIER_LABELS[rate.carrier]} {rate.service}
                  </span>
                  {compare && rate.rateId === cheapest.rateId ? <Badge color="success">Más económico</Badge> : null}
                  {compare && rate.rateId === fastest.rateId && rate.rateId !== cheapest.rateId ? <Badge color="neutral">Más rápido</Badge> : null}
                </span>
                <span className="block text-body-sm text-muted-foreground-strong">{daysLabel(rate.estimatedDays)}</span>
              </span>
              <span className="shrink-0 font-mono text-data tabular-nums text-foreground">{formatMoneyMXN(rate.amountCents)}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-body-sm text-muted-foreground-strong">Estas tarifas siguen vigentes hasta las {formatTime(expiresAt)}.</p>
    </fieldset>
  );
}

export { ShippingRates };
