"use client";

import { AddressFields } from "@/components/addresses/address-fields";
import { Skeleton } from "@/components/ui/skeleton";
import type { useShippingSelection } from "@/lib/storefront/checkout/use-shipping-selection";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY } from "../cart/cta-styles";
import { QuoteError, QuoteNotice, QuoteSkeleton } from "./quote-states";
import { SavedAddressPicker } from "./saved-address-picker";
import { ShippingRates } from "./shipping-rates";

interface ShippingStepProps {
  selection: ReturnType<typeof useShippingSelection>;
  /** Algo del carrito se agotó: no se cotiza hasta quitarlo. */
  blocked: boolean;
  /** Aviso que llega de más adelante (cotización vencida al pagar, carrito cambiado). */
  notice: string | null;
}

/**
 * Paso de envío: la dirección (una guardada o una nueva) y, debajo, las opciones
 * cotizadas en vivo. La cotización es una acción explícita ("Ver opciones de
 * envío"): cada llamada va a la paquetería. Caras: lista, cotizando (esqueleto
 * con la forma de las tarjetas), error con reintento, sin cobertura y vencida.
 */
function ShippingStep({ selection, blocked, notice }: ShippingStepProps) {
  const { saved, addresses, choice, form, errors, quote, rate } = selection;
  const quoting = quote.status === "loading";

  return (
    <div className="flex max-w-xl flex-col gap-8">
      {notice ? <QuoteNotice message={notice} /> : null}

      {saved.status === "loading" ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : (
        <>
          {addresses.length > 0 ? <SavedAddressPicker addresses={addresses} choice={choice} onChooseSaved={selection.chooseSaved} onChooseNew={selection.chooseNew} /> : null}
          {choice.kind === "new" ? <AddressFields value={form} onChange={selection.editForm} errors={errors} /> : null}
        </>
      )}

      <div aria-live="polite" className="flex flex-col gap-4">
        {quote.status === "loading" ? <QuoteSkeleton /> : null}
        {quote.status === "error" ? <QuoteError onRetry={selection.requestQuote} /> : null}
        {quote.status === "empty" ? <QuoteNotice message={quote.message} hint="Prueba con otra dirección." /> : null}
        {quote.status === "unavailable" ? <QuoteNotice message={quote.message} hint="Quítalo de tu carrito para continuar." /> : null}
        {quote.status === "invalid" ? <QuoteNotice message="Revisa los datos de la dirección marcados arriba." /> : null}
        {quote.status === "expired" ? <QuoteNotice message="Las tarifas vencieron." hint="Vuelve a consultarlas para ver precios al día." /> : null}
        {quote.status === "ready" && rate ? (
          <ShippingRates rates={selection.rates} selectedId={rate.rateId} onSelect={selection.selectRate} expiresAt={quote.quote.expiresAt} />
        ) : null}
      </div>

      {quote.status === "ready" && rate ? (
        <button type="button" onClick={selection.confirm} className={`${CTA_PRIMARY} self-start`}>
          Continuar al pago
        </button>
      ) : blocked || quoting || saved.status === "loading" ? (
        <span aria-disabled="true" className={`${CTA_DISABLED} self-start`}>
          Ver opciones de envío
        </span>
      ) : (
        <button type="button" onClick={selection.requestQuote} className={`${CTA_SECONDARY} self-start`}>
          Ver opciones de envío
        </button>
      )}
    </div>
  );
}

export { ShippingStep };
