"use client";

import { AddressFields } from "@/components/addresses/address-fields";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoneyMXN } from "@/lib/format-money";
import { DELIVERY_HINTS, DELIVERY_LABELS, LOCAL_DELIVERY_FEE_CENTS, type DeliveryMethod } from "@/lib/storefront/delivery";
import type { useDeliverySelection } from "@/lib/storefront/checkout/use-delivery-selection";
import { CTA_DISABLED, CTA_PRIMARY, CTA_WIDTH, FOCUS, LABEL } from "../cart/cta-styles";
import { SavedAddressPicker } from "./saved-address-picker";

interface DeliveryStepProps {
  selection: ReturnType<typeof useDeliverySelection>;
}

const CARD =
  "flex min-h-16 cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors duration-[var(--duration-base)] ease-out-quart has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";

function cardClass(selected: boolean): string {
  return `${CARD} ${selected ? "border-primary-action bg-blush" : "border-border-strong bg-surface hover:bg-muted"}`;
}

interface OptionProps {
  name: string;
  method: DeliveryMethod;
  selected: boolean;
  title: string;
  hint: string;
  price?: string;
  onSelect: () => void;
}

/** Una forma de entrega como radio nativo oculto con la tarjeta como control visible (mismo patrón que las tarifas). */
function Option({ name, method, selected, title, hint, price, onSelect }: OptionProps) {
  return (
    <label className={cardClass(selected)}>
      <input type="radio" name={name} value={method} checked={selected} onChange={onSelect} className={`sr-only ${FOCUS}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-subtitle text-foreground">{title}</span>
        <span className="block text-body-sm text-muted-foreground-strong">{hint}</span>
      </span>
      {price ? <span className="shrink-0 font-mono text-data tabular-nums text-foreground">{price}</span> : null}
    </label>
  );
}

/**
 * Paso de entrega del checkout por WhatsApp. Dos caminos: entrega local (con dos
 * variantes, recoger en tienda gratis o a domicilio por $50) y envío nacional,
 * cuyo costo se acuerda por WhatsApp. La dirección solo se pide cuando hay algo
 * que llevar; recoger en tienda pide, a lo mucho, el celular de contacto.
 */
function DeliveryStep({ selection }: DeliveryStepProps) {
  const { method, saved, addresses, choice, form, errors } = selection;
  const isLocal = method === "pickup" || method === "local";

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <fieldset>
        <legend className={`mb-3 ${LABEL}`}>Forma de entrega</legend>
        <div className="flex flex-col gap-2">
          <Option
            name="delivery-group"
            method="pickup"
            selected={isLocal}
            title="Entrega local"
            hint="Recógelo en la tienda o te lo llevamos a domicilio."
            onSelect={() => selection.choose(isLocal ? (method as DeliveryMethod) : "pickup")}
          />
          {isLocal ? (
            <div className="ml-4 flex flex-col gap-2 border-l border-border-strong pl-4">
              <Option name="delivery-local" method="pickup" selected={method === "pickup"} title={DELIVERY_LABELS.pickup} hint={DELIVERY_HINTS.pickup} price="Gratis" onSelect={() => selection.choose("pickup")} />
              <Option name="delivery-local" method="local" selected={method === "local"} title="A domicilio" hint={DELIVERY_HINTS.local} price={formatMoneyMXN(LOCAL_DELIVERY_FEE_CENTS)} onSelect={() => selection.choose("local")} />
            </div>
          ) : null}
          <Option name="delivery-group" method="national" selected={method === "national"} title={DELIVERY_LABELS.national} hint={DELIVERY_HINTS.national} onSelect={() => selection.choose("national")} />
        </div>
      </fieldset>

      {method !== null && method !== "pickup" ? (
        saved.status === "loading" ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {addresses.length > 0 ? <SavedAddressPicker addresses={addresses} choice={choice} onChooseSaved={selection.chooseSaved} onChooseNew={selection.chooseNew} /> : null}
            {choice.kind === "new" ? <AddressFields value={form} onChange={selection.editForm} errors={errors} splitName /> : null}
          </div>
        )
      ) : null}

      {selection.needsPickupPhone ? (
        <Input
          label="Celular de contacto"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="5512345678"
          helper="Te escribimos por WhatsApp a este número."
          value={selection.pickupPhone}
          error={selection.pickupPhoneError ?? undefined}
          onChange={(event) => selection.editPickupPhone(event.target.value)}
        />
      ) : null}

      {method === null ? (
        <span aria-disabled="true" className={`${CTA_DISABLED} ${CTA_WIDTH}`}>
          Continuar
        </span>
      ) : (
        <button type="button" onClick={selection.confirm} className={`${CTA_PRIMARY} ${CTA_WIDTH}`}>
          Continuar
        </button>
      )}
    </div>
  );
}

export { DeliveryStep };
