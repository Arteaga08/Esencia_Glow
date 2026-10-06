"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicShippingAddress, PublicShippingRate } from "@esencia-glow/shared";
import { AddressFields, addressToFormValue, type AddressFormValue } from "@/components/addresses/address-fields";
import { CTA_DISABLED, CTA_PRIMARY } from "@/components/storefront/cart/cta-styles";
import { QuoteError, QuoteSkeleton } from "./quote-states";
import { ShippingRates } from "./shipping-rates";

interface ShippingStepProps {
  /** `?estado=` de la vista: `cotizando` o `error`; sin él, tarifas listas. */
  state: string | null;
  address: PublicShippingAddress;
  rates: PublicShippingRate[];
  selectedRateId: string;
  onSelectRate: (rateId: string) => void;
  /** Siguiente paso (pago). */
  nextHref: string;
  /** Misma vista sin estado, para "Reintentar". */
  retryHref: string;
}

/**
 * Paso de envío: la dirección (mismos campos que el panel) y, debajo, las
 * opciones cotizadas en vivo. Tres caras de la cotización: lista, cotizando
 * (esqueleto con la forma de las tarjetas) y error (con reintento).
 */
function ShippingStep({ state, address, rates, selectedRateId, onSelectRate, nextHref, retryHref }: ShippingStepProps) {
  const [form, setForm] = useState<AddressFormValue>(() => addressToFormValue(address));
  const quoting = state === "cotizando";
  const failed = state === "error";

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <AddressFields value={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />

      <div aria-live="polite">
        {quoting ? <QuoteSkeleton /> : failed ? <QuoteError retryHref={retryHref} /> : <ShippingRates rates={rates} selectedId={selectedRateId} onSelect={onSelectRate} />}
      </div>

      {quoting || failed ? (
        <span aria-disabled="true" className={`${CTA_DISABLED} self-start`}>
          Continuar al pago
        </span>
      ) : (
        <Link href={nextHref} className={`${CTA_PRIMARY} self-start`}>
          Continuar al pago
        </Link>
      )}
    </div>
  );
}

export { ShippingStep };
