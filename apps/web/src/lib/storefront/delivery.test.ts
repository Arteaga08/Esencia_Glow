import { describe, expect, it } from "vitest";
import { LOCAL_DELIVERY_FEE_CENTS, deliveryNeedsAddress, deliveryShippingCents } from "./delivery";

describe("delivery", () => {
  it("recoger en tienda es gratis y el domicilio local cuesta $50", () => {
    expect(deliveryShippingCents("pickup")).toBe(0);
    expect(deliveryShippingCents("local")).toBe(LOCAL_DELIVERY_FEE_CENTS);
    expect(LOCAL_DELIVERY_FEE_CENTS).toBe(5000);
  });

  it("el envío nacional no tiene costo todavía: se acuerda por WhatsApp", () => {
    expect(deliveryShippingCents("national")).toBeNull();
  });

  it("solo recoger en tienda se pide sin dirección", () => {
    expect(deliveryNeedsAddress("pickup")).toBe(false);
    expect(deliveryNeedsAddress("local")).toBe(true);
    expect(deliveryNeedsAddress("national")).toBe(true);
  });
});
