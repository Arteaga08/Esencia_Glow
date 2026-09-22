import { vi } from "vitest";
import type { ShippingProvider } from "../../src/services/shipping-provider.js";
import { createStubShippingProvider } from "../../src/services/shipping-stub-provider.js";

/**
 * Proveedor de envíos falso, determinista y sin red — mismo criterio que
 * `buildFakePaymentProvider`. Por defecto delega en el stub REAL (así la
 * lógica de tarifas y guías de prueba vive en un solo lugar) pero envuelto
 * en `vi.fn()`, para que un test pueda contar llamadas (p. ej. "exactamente
 * una compra de guía") o sobrescribir un método con `overrides`.
 */
function buildFakeShippingProvider(overrides: Partial<ShippingProvider> = {}): ShippingProvider {
  const stub = createStubShippingProvider();

  return {
    name: "stub",
    getRates: vi.fn().mockImplementation((...args: Parameters<ShippingProvider["getRates"]>) => stub.getRates(...args)),
    purchaseLabel: vi
      .fn()
      .mockImplementation((...args: Parameters<ShippingProvider["purchaseLabel"]>) => stub.purchaseLabel(...args)),
    getLabel: vi.fn().mockImplementation((...args: Parameters<ShippingProvider["getLabel"]>) => stub.getLabel(...args)),
    ...overrides,
  };
}

export { buildFakeShippingProvider };
