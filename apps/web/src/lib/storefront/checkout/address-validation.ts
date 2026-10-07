import type { AddressFormValue } from "@/components/addresses/address-fields";
import { compact } from "@/components/storefront/account/shared/validation";

/**
 * Valida una dirección de envío de la tienda (nombre y apellidos por separado) y dice qué falta, pegado a su campo. Lo usan la
 * libreta de Mi cuenta (que además pide un nombre para la dirección: `label`) y
 * el checkout (que no lo pide: pasa `label` en `undefined`).
 */
function validateAddress(value: AddressFormValue, label?: string): Record<string, string> {
  return compact({
    ...(label === undefined ? {} : { label: label.trim().length === 0 ? "Ponle un nombre, por ejemplo Casa u Oficina." : undefined }),
    firstName: value.firstName.trim().length === 0 ? "Falta el nombre de quien recibe." : undefined,
    lastName: value.lastName.trim().length === 0 ? "Faltan los apellidos de quien recibe." : undefined,
    phone: value.phone.length !== 10 ? "Escribe los 10 dígitos del celular, sin espacios ni guiones." : undefined,
    street: value.street.trim().length === 0 ? "Falta la calle." : undefined,
    exteriorNumber: value.exteriorNumber.trim().length === 0 ? "Falta el número exterior." : undefined,
    neighborhood: value.neighborhood.trim().length === 0 ? "Falta la colonia." : undefined,
    city: value.city.trim().length === 0 ? "Falta la ciudad." : undefined,
    state: value.state ? undefined : "Elige un estado.",
    postalCode: value.postalCode.length !== 5 ? "Escribe los 5 dígitos del código postal." : undefined,
  });
}

export { validateAddress };
