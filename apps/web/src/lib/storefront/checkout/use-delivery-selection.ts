"use client";

import { useMemo, useState } from "react";
import type { PublicShippingAddress } from "@esencia-glow/shared";
import { EMPTY_ADDRESS_FORM, addressFormToBody, type AddressFormValue } from "@/components/addresses/address-fields";
import { deliveryNeedsAddress, type DeliveryMethod } from "../delivery";
import { validateAddress } from "./address-validation";
import { toDestination, type AddressChoice } from "./use-shipping-selection";
import { useSavedAddresses } from "./use-saved-addresses";

interface UseDeliverySelectionOptions {
  enabled: boolean;
}

/**
 * Lo que decide el paso de entrega del checkout por WhatsApp: la forma de
 * entrega, la dirección (guardada o nueva, solo si la entrega la necesita) y el
 * celular de contacto. No cotiza ni guarda nada en el servidor: al confirmar,
 * el mensaje de WhatsApp lleva todo. Cambiar de forma de entrega o de
 * dirección desconfirma el paso.
 */
function useDeliverySelection({ enabled }: UseDeliverySelectionOptions) {
  const saved = useSavedAddresses(enabled);
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [choice, setChoice] = useState<AddressChoice | null>(null);
  const [form, setForm] = useState<AddressFormValue>(EMPTY_ADDRESS_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickupPhone, setPickupPhone] = useState("");
  const [pickupPhoneError, setPickupPhoneError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const addresses = useMemo(() => (saved.status === "ready" ? saved.addresses : []), [saved]);
  const profilePhone = saved.status === "ready" ? (saved.profile.phone ?? "") : "";

  // La principal llega preseleccionada; sin libreta, se captura a mano.
  const effectiveChoice: AddressChoice =
    choice ?? (saved.status === "loading" ? { kind: "new" } : addresses.length > 0 ? { kind: "saved", id: (addresses.find((a) => a.isDefault) ?? addresses[0]!).id } : { kind: "new" });

  const selectedSaved = effectiveChoice.kind === "saved" ? addresses.find((candidate) => candidate.id === effectiveChoice.id) : undefined;
  const address: PublicShippingAddress | null =
    method === null || !deliveryNeedsAddress(method)
      ? null
      : selectedSaved
        ? toDestination(selectedSaved)
        : (addressFormToBody(form, true) as unknown as PublicShippingAddress);

  // Con dirección, el celular de contacto es el de quien recibe; al recoger, el del perfil o el que escriba.
  const contactPhone = address ? address.phone : profilePhone || pickupPhone.replace(/\D/g, "");

  const choose = (next: DeliveryMethod) => {
    setMethod(next);
    setConfirmed(false);
  };

  const chooseSaved = (id: string) => {
    setChoice({ kind: "saved", id });
    setErrors({});
    setConfirmed(false);
  };

  const chooseNew = () => {
    setChoice({ kind: "new" });
    setConfirmed(false);
  };

  const editForm = (patch: Partial<AddressFormValue>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const rest = { ...current };
      for (const key of Object.keys(patch)) delete rest[key];
      return rest;
    });
    setConfirmed(false);
  };

  const editPickupPhone = (value: string) => {
    setPickupPhone(value.replace(/\D/g, "").slice(0, 10));
    setPickupPhoneError(null);
    setConfirmed(false);
  };

  /** Valida lo que falte y, si todo está, deja el paso confirmado. */
  const confirm = () => {
    if (method === null) return;
    if (deliveryNeedsAddress(method)) {
      if (effectiveChoice.kind === "new") {
        const found = validateAddress(form);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
      } else if (!selectedSaved) {
        return;
      }
    } else if (contactPhone.length !== 10) {
      setPickupPhoneError("Escribe los 10 dígitos del celular, sin espacios ni guiones.");
      return;
    }
    setConfirmed(true);
  };

  return {
    saved,
    addresses,
    choice: effectiveChoice,
    form,
    errors,
    method,
    address,
    contactPhone,
    needsPickupPhone: method !== null && !deliveryNeedsAddress(method) && profilePhone === "",
    pickupPhone,
    pickupPhoneError,
    confirmed: confirmed && method !== null,
    choose,
    chooseSaved,
    chooseNew,
    editForm,
    editPickupPhone,
    confirm,
    reopen: () => setConfirmed(false),
  };
}

export { useDeliverySelection };
