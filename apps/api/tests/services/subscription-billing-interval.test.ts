import { describe, expect, it } from "vitest";
import {
  isPrepaidInterval,
  normalizeBillingInterval,
  PREPAID_INTERVAL_MONTHS,
} from "../../src/services/subscription-billing-interval.js";

describe("services/subscription-billing-interval", () => {
  it("quarter y year son prepagados; month y ausente no", () => {
    expect(isPrepaidInterval("quarter")).toBe(true);
    expect(isPrepaidInterval("year")).toBe(true);
    expect(isPrepaidInterval("month")).toBe(false);
    expect(isPrepaidInterval(undefined)).toBe(false);
  });

  it("meses cubiertos por cobro", () => {
    expect(PREPAID_INTERVAL_MONTHS).toEqual({ quarter: 3, year: 12 });
  });

  it("normalize: ausente se lee como month", () => {
    expect(normalizeBillingInterval(undefined)).toBe("month");
    expect(normalizeBillingInterval("quarter")).toBe("quarter");
  });
});
