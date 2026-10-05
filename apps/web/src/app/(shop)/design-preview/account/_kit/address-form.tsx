"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AddressFields, EMPTY_ADDRESS_FORM, type AddressFormValue } from "@/components/addresses/address-fields";
import { Input } from "@/components/ui/input";
import { CheckboxField } from "./checkbox-field";
import { CTA_PRIMARY, CTA_SECONDARY } from "./styles";
import { compact } from "./validation";

interface AddressFormProps {
  saveHref: string;
  cancelHref: string;
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
 * Alta de una dirección de la libreta (máximo 5). Reusa los campos del
 * checkout: una dirección guardada es la misma forma que la de un pedido, así
 * que elegirla al pagar no pide convertir nada.
 */
function AddressForm({ saveHref, cancelHref }: AddressFormProps) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [value, setValue] = useState<AddressFormValue>(EMPTY_ADDRESS_FORM);
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateAddress(value, label);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push(saveHref);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-5">
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
        maxLength={30}
        error={errors.label}
      />
      <AddressFields value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} errors={errors} />
      <CheckboxField checked={isDefault} onChange={setIsDefault}>
        Usar como mi dirección principal
      </CheckboxField>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={CTA_PRIMARY}>
          Guardar dirección
        </button>
        <Link href={cancelHref} className={CTA_SECONDARY}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export { AddressForm };
