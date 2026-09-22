import { describe, expect, it } from "vitest";
import {
  ShippingProviderError,
  __setShippingProviderForTests,
  resolveShippingProvider,
  selectShippingProvider,
} from "../../src/services/shipping-provider.js";
import { createStubShippingProvider } from "../../src/services/shipping-stub-provider.js";
import { buildFakeShippingProvider } from "../helpers/fake-shipping-provider.js";

describe("services/shipping-provider — ShippingProviderError", () => {
  it("es un Error con `kind` y conserva el mensaje", () => {
    const error = new ShippingProviderError("rejected", "Sin créditos");
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("rejected");
    expect(error.message).toBe("Sin créditos");
  });

  it("conserva la causa original cuando se le pasa", () => {
    const cause = new Error("ECONNRESET");
    const error = new ShippingProviderError("unknown_outcome", "Red caída", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("services/shipping-provider — selectShippingProvider (decisión pura)", () => {
  const stub = createStubShippingProvider();
  const real = buildFakeShippingProvider({ name: "skydropx" });

  it("en producción SIN adapter real devuelve undefined: el llamador responde 503, jamás cae al stub", () => {
    expect(selectShippingProvider({ isProduction: true, real: undefined, stub })).toBeUndefined();
  });

  it("en producción CON adapter real devuelve el real", () => {
    expect(selectShippingProvider({ isProduction: true, real, stub })).toBe(real);
  });

  it("fuera de producción SIN adapter real devuelve el stub", () => {
    expect(selectShippingProvider({ isProduction: false, real: undefined, stub })).toBe(stub);
  });

  it("fuera de producción CON adapter real prefiere el real (sandbox en desarrollo)", () => {
    expect(selectShippingProvider({ isProduction: false, real, stub })).toBe(real);
  });
});

describe("services/shipping-provider — resolveShippingProvider y seam de pruebas", () => {
  it("devuelve el proveedor inyectado con __setShippingProviderForTests", () => {
    const fake = buildFakeShippingProvider();
    __setShippingProviderForTests(fake);
    expect(resolveShippingProvider()).toBe(fake);
  });

  it("devuelve undefined cuando el test inyecta `undefined` (para probar el 503)", () => {
    __setShippingProviderForTests(undefined);
    expect(resolveShippingProvider()).toBeUndefined();
  });

  it("por defecto en la suite (setup.ts) resuelve el stub con name 'stub'", () => {
    expect(resolveShippingProvider()?.name).toBe("stub");
  });
});
