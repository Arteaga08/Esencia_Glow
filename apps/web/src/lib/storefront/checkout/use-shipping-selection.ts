"use client";

import { useCallback, useMemo, useState } from "react";
import type { CartLineInput, PublicShippingAddress, PublicShippingRate, SavedAddress } from "@esencia-glow/shared";
import { EMPTY_ADDRESS_FORM, addressFormToBody, type AddressFormValue } from "@/components/addresses/address-fields";
import { validateAddress } from "./address-validation";
import { cheapestRate } from "./shipping-labels";
import { useSavedAddresses } from "./use-saved-addresses";
import { useShippingQuote } from "./use-shipping-quote";

/** Una dirección guardada elegida, o la que se captura a mano. */
type AddressChoice = { kind: "saved"; id: string } | { kind: "new" };

function toDestination(address: SavedAddress): PublicShippingAddress {
  return {
    fullName: address.fullName,
    phone: address.phone,
    street: address.street,
    exteriorNumber: address.exteriorNumber,
    ...(address.interiorNumber ? { interiorNumber: address.interiorNumber } : {}),
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    ...(address.references ? { references: address.references } : {}),
  };
}

interface UseShippingSelectionOptions {
  enabled: boolean;
  lines: CartLineInput[];
}

/**
 * Todo lo que decide el paso de envío: qué dirección (guardada o nueva), su
 * cotización, la tarifa elegida y si ya se confirmó. Cambiar la dirección
 * invalida la cotización; si cambia el carrito, quien lo usa lo reinicia con un
 * `key` (el servidor compara la huella del carrito al crear el pedido).
 */
function useShippingSelection({ enabled, lines }: UseShippingSelectionOptions) {
  const saved = useSavedAddresses(enabled);
  const { state: quote, request, reset } = useShippingQuote();

  const [choice, setChoice] = useState<AddressChoice | null>(null);
  const [form, setForm] = useState<AddressFormValue>(EMPTY_ADDRESS_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickedRateId, setPickedRateId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const addresses = useMemo(() => (saved.status === "ready" ? saved.addresses : []), [saved]);

  // La principal llega preseleccionada; sin libreta, se captura a mano.
  const effectiveChoice: AddressChoice =
    choice ?? (saved.status === "loading" ? { kind: "new" } : addresses.length > 0 ? { kind: "saved", id: (addresses.find((a) => a.isDefault) ?? addresses[0]!).id } : { kind: "new" });

  const invalidate = useCallback(() => {
    reset();
    setPickedRateId(null);
    setConfirmed(false);
  }, [reset]);

  const chooseSaved = (id: string) => {
    setChoice({ kind: "saved", id });
    setErrors({});
    invalidate();
  };

  const chooseNew = () => {
    setChoice({ kind: "new" });
    invalidate();
  };

  const editForm = (patch: Partial<AddressFormValue>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const rest = { ...current };
      for (const key of Object.keys(patch)) delete rest[key];
      return rest;
    });
    invalidate();
  };

  const requestQuote = () => {
    if (effectiveChoice.kind === "saved") {
      const address = addresses.find((candidate) => candidate.id === effectiveChoice.id);
      if (address) void request(toDestination(address), lines);
      return;
    }
    const found = validateAddress(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void request(addressFormToBody(form) as unknown as PublicShippingAddress, lines);
  };

  const selectedSaved = effectiveChoice.kind === "saved" ? addresses.find((candidate) => candidate.id === effectiveChoice.id) : undefined;
  const destination: PublicShippingAddress | null = selectedSaved ? toDestination(selectedSaved) : effectiveChoice.kind === "new" ? (addressFormToBody(form) as unknown as PublicShippingAddress) : null;

  const rates: PublicShippingRate[] = quote.status === "ready" ? quote.quote.rates : [];
  // Sin elección explícita, la más económica queda preseleccionada.
  const rate = rates.find((candidate) => candidate.rateId === pickedRateId) ?? (rates.length > 0 ? cheapestRate(rates) : null);
  // El API objetó campos de la dirección: se pintan junto con los del formulario.
  const fieldErrors = quote.status === "invalid" ? { ...quote.errors, ...errors } : errors;

  return {
    saved,
    addresses,
    choice: effectiveChoice,
    form,
    errors: fieldErrors,
    quote,
    rates,
    rate,
    destination,
    confirmed: confirmed && quote.status === "ready" && rate !== null,
    chooseSaved,
    chooseNew,
    editForm,
    requestQuote,
    selectRate: setPickedRateId,
    confirm: () => setConfirmed(true),
    reopen: () => setConfirmed(false),
    restart: invalidate,
  };
}

export { useShippingSelection };
export type { AddressChoice };
