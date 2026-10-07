"use client";

import { MEXICAN_STATES, type PublicShippingAddress } from "@esencia-glow/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { joinName, splitFullName } from "./recipient-name";

const STATE_OPTIONS = MEXICAN_STATES.map((state) => ({ value: state, label: state }));

/** Forma de formulario de una dirección de envío — mismos campos que
 * `PublicShippingAddress` (más `firstName`/`lastName`, que la tienda pide por
 * separado y el panel ignora), pero con `state` como `string | null` (el
 * `Select` no acepta `undefined`) y los opcionales siempre presentes como
 * string vacío, nunca `undefined`, para que el input se mantenga controlado. */
interface AddressFormValue {
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  city: string;
  state: string | null;
  postalCode: string;
  references: string;
}

const EMPTY_ADDRESS_FORM: AddressFormValue = {
  fullName: "",
  firstName: "",
  lastName: "",
  phone: "",
  street: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: null,
  postalCode: "",
  references: "",
};

/** Una dirección anterior a nombre/apellidos no los trae: se separa el nombre completo en el primer espacio. */
function addressToFormValue(address: PublicShippingAddress): AddressFormValue {
  const name = address.firstName !== undefined && address.lastName !== undefined ? { firstName: address.firstName, lastName: address.lastName } : splitFullName(address.fullName);
  return {
    fullName: address.fullName,
    ...name,
    phone: address.phone,
    street: address.street,
    exteriorNumber: address.exteriorNumber,
    interiorNumber: address.interiorNumber ?? "",
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    references: address.references ?? "",
  };
}

/** Recorta espacios y omite los opcionales vacíos — mismo criterio que el
 * body que arma `shipping-address-modal.tsx` a mano. `state` puede ser
 * `null` si la admin no lo tocó (lo atrapa el validador de campo requerido,
 * no este helper). */
function addressFormToBody(value: AddressFormValue, splitName = false): Record<string, unknown> {
  const recipient = splitName
    ? { fullName: joinName(value.firstName, value.lastName), firstName: value.firstName.trim(), lastName: value.lastName.trim() }
    : { fullName: value.fullName.trim() };
  return {
    ...recipient,
    phone: value.phone.replace(/\D/g, ""),
    street: value.street.trim(),
    exteriorNumber: value.exteriorNumber.trim(),
    ...(value.interiorNumber.trim() ? { interiorNumber: value.interiorNumber.trim() } : {}),
    neighborhood: value.neighborhood.trim(),
    city: value.city.trim(),
    state: value.state,
    postalCode: value.postalCode.trim(),
    ...(value.references.trim() ? { references: value.references.trim() } : {}),
  };
}

interface AddressFieldsProps {
  value: AddressFormValue;
  onChange: (patch: Partial<AddressFormValue>) => void;
  errors?: Record<string, string>;
  /** La tienda pide nombre y apellidos por separado; el panel, un solo "Nombre completo". */
  splitName?: boolean;
}

/**
 * Campos de una dirección de envío mexicana, extraídos de
 * `shipping-address-modal.tsx` (Milestone 2.3b) para reusarlos también en
 * la dirección de origen de Settings (2.8) sin duplicar placeholders,
 * validación de dígitos ni la lista de estados.
 */
function AddressFields({ value, onChange, errors = {}, splitName = false }: AddressFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {splitName ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            placeholder="María"
            autoComplete="given-name"
            value={value.firstName}
            onChange={(event) => onChange({ firstName: event.target.value })}
            error={errors.firstName}
            required
          />
          <Input
            label="Apellidos"
            placeholder="López Hernández"
            autoComplete="family-name"
            value={value.lastName}
            onChange={(event) => onChange({ lastName: event.target.value })}
            error={errors.lastName}
            required
          />
        </div>
      ) : (
        <Input
          label="Nombre completo"
          placeholder="María López"
          value={value.fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          error={errors.fullName}
          required
        />
      )}
      <Input
        label="Teléfono"
        placeholder="3312345678"
        inputMode="numeric"
        value={value.phone}
        onChange={(event) => onChange({ phone: event.target.value.replace(/\D/g, "") })}
        error={errors.phone}
        maxLength={10}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Calle"
          placeholder="Av. Vallarta"
          value={value.street}
          onChange={(event) => onChange({ street: event.target.value })}
          error={errors.street}
          required
        />
        <Input
          label="Número exterior"
          placeholder="1234"
          value={value.exteriorNumber}
          onChange={(event) => onChange({ exteriorNumber: event.target.value })}
          error={errors.exteriorNumber}
          required
        />
      </div>
      <Input
        label="Número interior (opcional)"
        placeholder="Depto 4B"
        value={value.interiorNumber}
        onChange={(event) => onChange({ interiorNumber: event.target.value })}
        error={errors.interiorNumber}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Colonia"
          placeholder="Americana"
          value={value.neighborhood}
          onChange={(event) => onChange({ neighborhood: event.target.value })}
          error={errors.neighborhood}
          required
        />
        <Input
          label="Ciudad"
          placeholder="Guadalajara"
          value={value.city}
          onChange={(event) => onChange({ city: event.target.value })}
          error={errors.city}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Estado"
          value={value.state}
          onChange={(state) => onChange({ state })}
          options={STATE_OPTIONS}
          searchable
          placeholder="Jalisco"
          error={errors.state}
        />
        <Input
          label="Código postal"
          placeholder="44160"
          inputMode="numeric"
          value={value.postalCode}
          onChange={(event) => onChange({ postalCode: event.target.value.replace(/\D/g, "") })}
          error={errors.postalCode}
          maxLength={5}
          required
        />
      </div>
      <Textarea
        label="Referencias (opcional)"
        placeholder="Casa azul, portón negro"
        value={value.references}
        onChange={(event) => onChange({ references: event.target.value })}
        error={errors.references}
      />
    </div>
  );
}

export type { AddressFormValue };
export { AddressFields, EMPTY_ADDRESS_FORM, addressToFormValue, addressFormToBody };
