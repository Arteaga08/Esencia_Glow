import { describe, expect, it } from "vitest";
import { ShippingCarrier, STUB_SHIPPING_RATES_COUNT } from "@esencia-glow/shared";
import { ShippingProviderError } from "../../src/services/shipping-provider.js";
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

const origin = { ...destination, fullName: "Esencia Glow", postalCode: "44100" };

const parcel = { weightGrams: 500, lengthCm: 15, widthCm: 15, heightCm: 11, volumetricWeightGrams: 1000 };

const purchaseInput = {
  orderId: "64b7f0c2a1b2c3d4e5f60718",
  orderNumber: "EG-1001",
  providerRateId: "stub-1",
  origin,
  destination,
  parcel,
  idempotencyKey: "label-64b7f0c2a1b2c3d4e5f60718",
};

describe("services/shipping-stub-provider — cotización", () => {
  it("se identifica como 'stub'", () => {
    expect(createStubShippingProvider().name).toBe("stub");
  });

  it("devuelve STUB_SHIPPING_RATES_COUNT tarifas fijas", async () => {
    const provider = createStubShippingProvider();
    const { rates } = await provider.getRates(destination, parcel, {});
    expect(rates).toHaveLength(STUB_SHIPPING_RATES_COUNT);
  });

  it("cada tarifa trae carrier, service, amountCents entero, estimatedDays y providerRateId", async () => {
    const provider = createStubShippingProvider();
    const { rates } = await provider.getRates(destination, parcel, {});
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
    const first = await provider.getRates(destination, parcel, {});
    const second = await provider.getRates(destination, parcel, {});
    expect(first).toEqual(second);
  });

  it("las tarifas tienen montos distintos entre sí (no son la misma opción repetida)", async () => {
    const provider = createStubShippingProvider();
    const { rates } = await provider.getRates(destination, parcel, {});
    const amounts = new Set(rates.map((r) => r.amountCents));
    expect(amounts.size).toBe(rates.length);
  });

  it("con la señal ya abortada rechaza con ShippingProviderError 'unavailable' sin cotizar", async () => {
    const provider = createStubShippingProvider();
    const controller = new AbortController();
    controller.abort();
    const error = await provider.getRates(destination, parcel, { signal: controller.signal }).catch((e) => e);
    expect(error).toBeInstanceOf(ShippingProviderError);
    expect(error.kind).toBe("unavailable");
  });
});

describe("services/shipping-stub-provider — guía", () => {
  it("purchaseLabel devuelve 'ready' con tracking determinista derivado del pedido", async () => {
    const provider = createStubShippingProvider();
    const result = await provider.purchaseLabel(purchaseInput, {});
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("inalcanzable");
    expect(result.trackingNumber).toBe(`STUB-${purchaseInput.orderId}`);
    expect(result.providerShipmentId).toContain(purchaseInput.orderId);
    expect(result.labelUrl).toMatch(/^https:\/\//);
  });

  it("purchaseLabel deriva la paquetería del providerRateId elegido", async () => {
    const provider = createStubShippingProvider();
    const result = await provider.purchaseLabel({ ...purchaseInput, providerRateId: "stub-1" }, {});
    if (result.status !== "ready") throw new Error("inalcanzable");
    expect(result.carrier).toBe(ShippingCarrier.FEDEX);
  });

  it("purchaseLabel con un providerRateId desconocido rechaza con kind 'rejected'", async () => {
    const provider = createStubShippingProvider();
    const error = await provider
      .purchaseLabel({ ...purchaseInput, providerRateId: "no-existe" }, {})
      .catch((e) => e);
    expect(error).toBeInstanceOf(ShippingProviderError);
    expect(error.kind).toBe("rejected");
  });

  it("getLabel con un providerShipmentId desconocido rechaza con kind 'rejected'", async () => {
    const provider = createStubShippingProvider();
    const error = await provider.getLabel("no-es-del-stub", {}).catch((e) => e);
    expect(error).toBeInstanceOf(ShippingProviderError);
    expect(error.kind).toBe("rejected");
  });

  it("getLabel devuelve la misma guía que purchaseLabel para el mismo providerShipmentId", async () => {
    const provider = createStubShippingProvider();
    const bought = await provider.purchaseLabel(purchaseInput, {});
    if (bought.status !== "ready") throw new Error("inalcanzable");
    const fetched = await provider.getLabel(bought.providerShipmentId, {});
    expect(fetched).toEqual(bought);
  });

  it("purchaseLabel con la señal ya abortada rechaza con 'unavailable' (nada se envió, es seguro reintentar)", async () => {
    const provider = createStubShippingProvider();
    const controller = new AbortController();
    controller.abort();
    const error = await provider.purchaseLabel(purchaseInput, { signal: controller.signal }).catch((e) => e);
    expect(error).toBeInstanceOf(ShippingProviderError);
    expect(error.kind).toBe("unavailable");
  });
});
