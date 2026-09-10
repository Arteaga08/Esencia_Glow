import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { ShippingQuote } from "../../src/models/shipping-quote.model.js";

function buildQuoteAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    userId: overrides.userId ?? new mongoose.Types.ObjectId(),
    cartFingerprint: overrides.cartFingerprint ?? "fingerprint-abc",
    destination: {
      fullName: "Ana Pérez",
      phone: "5512345678",
      street: "Av. Reforma",
      exteriorNumber: "100",
      neighborhood: "Juárez",
      city: "CDMX",
      state: "Ciudad de México",
      postalCode: "06600",
    },
    parcel: { weightGrams: 350, lengthCm: 15, widthCm: 15, heightCm: 11, volumetricWeightGrams: 1000 },
    rates: [
      {
        rateId: "rate-1",
        carrier: "estafeta",
        service: "standard",
        amountCents: 12000,
        currency: "MXN",
        estimatedDays: 3,
        providerRateId: "stub-1",
      },
    ],
    cheapestAmountCents: 12000,
    provider: "stub",
    expiresAt: overrides.expiresAt ?? new Date(now + 60 * 60_000),
    purgeAt: overrides.purgeAt ?? new Date(now + 25 * 60 * 60_000),
    ...overrides,
  };
}

describe("models/ShippingQuote", () => {
  it("crea una cotización válida con sus tarifas", async () => {
    const quote = await ShippingQuote.create(buildQuoteAttrs());
    expect(quote.rates).toHaveLength(1);
    expect(quote.provider).toBe("stub");
  });

  it("guarda providerRateId pero no lo requiere el DTO público (verificado en shipping-quote.service)", async () => {
    const quote = await ShippingQuote.create(buildQuoteAttrs());
    expect(quote.rates[0]!.providerRateId).toBe("stub-1");
  });

  it("no exige un solo uso: consumedByOrderId es opcional y ausente al crear", async () => {
    const quote = await ShippingQuote.create(buildQuoteAttrs());
    expect(quote.consumedByOrderId).toBeUndefined();
  });

  it("tiene índice TTL declarado sobre purgeAt", async () => {
    const indexes = await ShippingQuote.collection.indexes();
    const ttlIndex = indexes.find((idx) => "purgeAt" in idx.key);
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });
});
