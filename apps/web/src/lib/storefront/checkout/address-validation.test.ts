import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS_FORM, type AddressFormValue } from "@/components/addresses/address-fields";
import { validateAddress } from "./address-validation";

const VALID: AddressFormValue = {
  ...EMPTY_ADDRESS_FORM,
  fullName: "María López",
  phone: "3312345678",
  street: "Av. Vallarta",
  exteriorNumber: "1234",
  neighborhood: "Americana",
  city: "Guadalajara",
  state: "Jalisco",
  postalCode: "44160",
};

describe("validateAddress", () => {
  it("una dirección completa no tiene errores", () => {
    expect(validateAddress(VALID)).toEqual({});
  });

  it("dice qué falta, pegado a su campo", () => {
    const errors = validateAddress(EMPTY_ADDRESS_FORM);
    expect(Object.keys(errors).sort()).toEqual(["city", "exteriorNumber", "fullName", "neighborhood", "phone", "postalCode", "state", "street"]);
    expect(errors.phone).toMatch(/10 dígitos/);
    expect(errors.postalCode).toMatch(/5 dígitos/);
  });

  it("la etiqueta solo se exige cuando se pasa (libreta sí, checkout no)", () => {
    expect(validateAddress(VALID, "   ").label).toMatch(/nombre/i);
    expect(validateAddress(VALID, "Casa")).toEqual({});
    expect(validateAddress(VALID)).not.toHaveProperty("label");
  });

  it("un teléfono o código postal a medias es error", () => {
    expect(validateAddress({ ...VALID, phone: "331234" }).phone).toBeDefined();
    expect(validateAddress({ ...VALID, postalCode: "4416" }).postalCode).toBeDefined();
  });
});
