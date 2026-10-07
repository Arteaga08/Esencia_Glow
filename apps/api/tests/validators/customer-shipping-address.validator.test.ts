import { describe, expect, it } from "vitest";
import { customerShippingAddressSchema, shippingAddressSchema } from "../../src/validators/shipping.validator.js";
import { createAddressSchema, updateAddressSchema } from "../../src/validators/account.validator.js";

const base = {
  phone: "3312345678",
  street: "Av. Vallarta",
  exteriorNumber: "1234",
  neighborhood: "Americana",
  city: "Guadalajara",
  state: "Jalisco",
  postalCode: "44160",
};

const options = { abortEarly: false, stripUnknown: true } as const;

describe("validators/customerShippingAddressSchema", () => {
  it("exige nombre y apellidos y deriva fullName", () => {
    const { error, value } = customerShippingAddressSchema.validate({ ...base, firstName: "María", lastName: "López" }, options);
    expect(error).toBeUndefined();
    expect(value.fullName).toBe("María López");
  });

  it("rechaza una dirección sin apellidos", () => {
    const { error } = customerShippingAddressSchema.validate({ ...base, firstName: "María" }, options);
    expect(error?.details.map((d) => d.path.join("."))).toContain("lastName");
  });

  it("rechaza un fullName suelto sin nombre y apellidos", () => {
    const { error } = customerShippingAddressSchema.validate({ ...base, fullName: "María López" }, options);
    expect(error?.details.map((d) => d.path.join("."))).toEqual(expect.arrayContaining(["firstName", "lastName"]));
  });

  it("ignora un fullName mandado junto con nombre y apellidos: manda la unión", () => {
    const { value } = customerShippingAddressSchema.validate({ ...base, firstName: "María", lastName: "López", fullName: "Otro Nombre" }, options);
    expect(value.fullName).toBe("María López");
  });
});

describe("validators/shippingAddressSchema (panel)", () => {
  it("sigue pidiendo un solo fullName", () => {
    const { error, value } = shippingAddressSchema.validate({ ...base, fullName: "Esencia Glow" }, options);
    expect(error).toBeUndefined();
    expect(value.fullName).toBe("Esencia Glow");
  });
});

describe("validators/account — libreta", () => {
  it("el alta pide nombre y apellidos y deriva fullName", () => {
    const { error, value } = createAddressSchema.validate({ ...base, label: "Casa", firstName: "María", lastName: "López" }, options);
    expect(error).toBeUndefined();
    expect(value.fullName).toBe("María López");
  });

  it("la edición acepta solo la calle", () => {
    const { error, value } = updateAddressSchema.validate({ street: "Reforma" }, options);
    expect(error).toBeUndefined();
    expect(value.fullName).toBeUndefined();
  });

  it("la edición exige nombre y apellidos juntos", () => {
    const { error } = updateAddressSchema.validate({ firstName: "María" }, options);
    expect(error).toBeDefined();
  });

  it("la edición con ambos recalcula fullName", () => {
    const { value } = updateAddressSchema.validate({ firstName: "Ana", lastName: "Ruiz" }, options);
    expect(value.fullName).toBe("Ana Ruiz");
  });

  it("rechaza HTML en el nombre", () => {
    const { error } = createAddressSchema.validate({ ...base, label: "Casa", firstName: "<b>x</b>", lastName: "López" }, options);
    expect(error?.details.map((d) => d.path.join("."))).toContain("firstName");
  });
});
