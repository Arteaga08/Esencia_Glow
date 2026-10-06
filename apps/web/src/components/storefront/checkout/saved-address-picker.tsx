"use client";

import type { SavedAddress } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import type { AddressChoice } from "@/lib/storefront/checkout/use-shipping-selection";
import { FOCUS, LABEL } from "../cart/cta-styles";

interface SavedAddressPickerProps {
  addresses: SavedAddress[];
  choice: AddressChoice;
  onChooseSaved: (id: string) => void;
  onChooseNew: () => void;
}

const CARD = "flex min-h-16 cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors duration-[var(--duration-base)] ease-out-quart has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";

function cardClass(selected: boolean): string {
  return `${CARD} ${selected ? "border-primary-action bg-blush" : "border-border-strong bg-surface hover:bg-muted"}`;
}

/**
 * Libreta de direcciones como radios nativos ocultos con la tarjeta de control
 * visible (mismo patrón que las tarifas). La principal llega preseleccionada y
 * "Usar otra dirección" abre el formulario. Lo que se capture aquí no se guarda
 * en la libreta: eso se hace en Mi cuenta.
 */
function SavedAddressPicker({ addresses, choice, onChooseSaved, onChooseNew }: SavedAddressPickerProps) {
  return (
    <fieldset>
      <legend className={`mb-3 ${LABEL}`}>Dirección de envío</legend>
      <div className="flex flex-col gap-2">
        {addresses.map((address) => {
          const selected = choice.kind === "saved" && choice.id === address.id;
          const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");
          return (
            <label key={address.id} className={cardClass(selected)}>
              <input type="radio" name="shipping-address" checked={selected} onChange={() => onChooseSaved(address.id)} className={`sr-only ${FOCUS}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-subtitle text-foreground">{address.label}</span>
                  {address.isDefault ? <Badge color="neutral">Principal</Badge> : null}
                </span>
                <span className="block text-body-sm text-foreground">{address.fullName}</span>
                <span className="block text-body-sm text-muted-foreground-strong">
                  {street}, {address.neighborhood}. {address.city}, {address.state}, {address.postalCode}
                </span>
              </span>
            </label>
          );
        })}
        <label className={cardClass(choice.kind === "new")}>
          <input type="radio" name="shipping-address" checked={choice.kind === "new"} onChange={onChooseNew} className={`sr-only ${FOCUS}`} />
          <span className="text-subtitle text-foreground">Usar otra dirección</span>
        </label>
      </div>
    </fieldset>
  );
}

export { SavedAddressPicker };
