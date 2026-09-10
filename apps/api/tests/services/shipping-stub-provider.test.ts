import { describe, expect, it } from "vitest";
import { STUB_SHIPPING_RATES_COUNT } from "@esencia-glow/shared";
import { createStubShippingProvider } from "../../src/services/shipping-stub-provider.js";

const destination = {
  fullName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma",
  exteriorNumber: "100",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México" as const,
  postalCode: "06600",
};

const parcel = { weightGrams: 500, lengthCm: 15, widthCm: 15, heightCm: 11, volumetricWeightGrams: 1000 };

describe("services/shipping-stub-provider", () => {
  it("devuelve STUB_SHIPPING_RATES_COUNT tarifas fijas", async () => {
    const provider = createStubShippingProvider();
    const rates = await provider.getRates(destination, parcel);
    expect(rates).toHaveLength(STUB_SHIPPING_RATES_COUNT);
  });

  it("cada tarifa trae carrier, service, amountCents entero, estimatedDays y providerRateId", async () => {
    const provider = createStubShippingProvider();
    const rates = await provider.getRates(destination, parcel);
    for (const rate of rates) {
      expect(typeof rate.carrier).toBe("string");
      expect(typeof rate.service).toBe("string");
      expect(Number.isInteger(rate.amountCents)).toBe(true);
      expect(rate.amountCents).toBeGreaterThan(0);
      expect(rate.estimatedDays).toBeGreaterThan(0);
      expect(typeof rate.providerRateId).toBe("string");
    }
  });

  it("es determinista para el mismo destino y paquete", async () => {
    const provider = createStubShippingProvider();
    const first = await provider.getRates(destination, parcel);
    const second = await provider.getRates(destination, parcel);
    expect(first).toEqual(second);
  });

  it("las tarifas tienen montos distintos entre sí (no son la misma opción repetida)", async () => {
    const provider = createStubShippingProvider();
    const rates = await provider.getRates(destination, parcel);
    const amounts = new Set(rates.map((r) => r.amountCents));
    expect(amounts.size).toBe(rates.length);
  });
});
