"use client";

import { useState, type FormEvent } from "react";
import type { SavedAddress } from "@esencia-glow/shared";
import { AddressFields, EMPTY_ADDRESS_FORM, addressFormToBody, addressToFormValue, type AddressFormValue } from "@/components/addresses/address-fields";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { CheckboxField } from "../shared/checkbox-field";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY } from "../shared/styles";
import { compact } from "../shared/validation";

interface AddressFormProps {
  /** Con `address` se edita; sin ella se crea. */
  address?: SavedAddress;
  /** La primera dirección queda principal sola: no se pregunta. */
  isFirst: boolean;
  onSaved: () => void;
  onCancel: () => void;
}

function validateAddress(value: AddressFormValue, label: string) {
  return compact({
    label: label.trim().length === 0 ? "Ponle un nombre, por ejemplo Casa u Oficina." : undefined,
    fullName: value.fullName.trim().length === 0 ? "Falta el nombre de quien recibe." : undefined,
    phone: value.phone.length !== 10 ? "Escribe los 10 dígitos del celular, sin espacios ni guiones." : undefined,
    street: value.street.trim().length === 0 ? "Falta la calle." : undefined,
    exteriorNumber: value.exteriorNumber.trim().length === 0 ? "Falta el número exterior." : undefined,
    neighborhood: value.neighborhood.trim().length === 0 ? "Falta la colonia." : undefined,
    city: value.city.trim().length === 0 ? "Falta la ciudad." : undefined,
    state: value.state ? undefined : "Elige un estado.",
    postalCode: value.postalCode.length !== 5 ? "Escribe los 5 dígitos del código postal." : undefined,
  });
}

/**
 * Alta o edición de una dirección de la libreta (máximo 5). Reusa los campos del
 * checkout: una dirección guardada es la misma forma que la de un pedido, así que
 * elegirla al pagar no pide convertir nada.
 */
function AddressForm({ address, isFirst, onSaved, onCancel }: AddressFormProps) {
  const [label, setLabel] = useState(address?.label ?? "");
  const [value, setValue] = useState<AddressFormValue>(address ? addressToFormValue(address) : EMPTY_ADDRESS_FORM);
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const found = validateAddress(value, label);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...addressFormToBody(value), label: label.trim() };
      if (address) {
        // Un opcional vaciado se manda como null para que el API lo borre.
        await accountRequest(`/api/v1/account/addresses/${address.id}`, {
          method: "PATCH",
          body: { ...body, interiorNumber: body.interiorNumber ?? null, references: body.references ?? null },
        });
      } else {
        const created = await accountRequest<SavedAddress>("/api/v1/account/addresses", { method: "POST", body });
        if (makeDefault && !created.data.isDefault) {
          await accountRequest(`/api/v1/account/addresses/${created.data.id}/default`, { method: "POST" });
        }
      }
      onSaved();
    } catch (caught) {
      const failure = classifyError(caught);
      if (Object.keys(failure.fieldErrors).length > 0) setErrors(failure.fieldErrors);
      else setFormError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={saving} className="flex max-w-xl flex-col gap-5">
      {formError ? <FieldError message={formError} /> : null}
      <Input
        label="Nombre de la dirección"
        value={label}
        onChange={(event) => {
          setLabel(event.target.value);
          setErrors((current) => {
            const rest = { ...current };
            delete rest.label;
            return rest;
          });
        }}
        placeholder="Casa"
        maxLength={40}
        error={errors.label}
      />
      <AddressFields value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} errors={errors} />
      {address || isFirst ? null : (
        <CheckboxField checked={makeDefault} onChange={setMakeDefault}>
          Usar como mi dirección principal
        </CheckboxField>
      )}
      <div className="flex flex-wrap gap-3">
        {saving ? (
          <span className={CTA_DISABLED}>Guardando…</span>
        ) : (
          <button type="submit" className={CTA_PRIMARY}>
            Guardar dirección
          </button>
        )}
        <button type="button" onClick={onCancel} className={CTA_SECONDARY}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export { AddressForm };
