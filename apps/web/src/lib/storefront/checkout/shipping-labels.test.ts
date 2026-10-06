import { ShippingCarrier, type PublicShippingRate } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { cheapestRate, daysLabel, fastestRate, rateSummary } from "./shipping-labels";

function rate(id: string, amountCents: number, estimatedDays: number): PublicShippingRate {
  return { rateId: id, carrier: ShippingCarrier.FEDEX, service: "Express", amountCents, currency: "MXN", estimatedDays };
}

describe("shipping-labels", () => {
  const rates = [rate("a", 14900, 2), rate("b", 9900, 5), rate("c", 19900, 1)];

  it("la más barata y la más rápida", () => {
    expect(cheapestRate(rates).rateId).toBe("b");
    expect(fastestRate(rates).rateId).toBe("c");
  });

  it("singular y plural de días hábiles", () => {
    expect(daysLabel(1)).toBe("Llega en 1 día hábil");
    expect(daysLabel(3)).toBe("Llega en 3 días hábiles");
  });

  it("resumen de un renglón", () => {
    expect(rateSummary(rate("a", 14900, 2))).toBe("FedEx Express, $149.00, llega en 2 días hábiles");
  });
});
