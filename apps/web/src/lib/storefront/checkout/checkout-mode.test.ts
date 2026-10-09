import { describe, expect, it } from "vitest";
import { parseCheckoutMode } from "./checkout-mode";

describe("parseCheckoutMode", () => {
  it("solo `stripe` activa el cobro con tarjeta", () => {
    expect(parseCheckoutMode("stripe")).toBe("stripe");
    expect(parseCheckoutMode(" Stripe ")).toBe("stripe");
  });

  it("sin valor o con uno desconocido cae en WhatsApp", () => {
    expect(parseCheckoutMode(undefined)).toBe("whatsapp");
    expect(parseCheckoutMode("")).toBe("whatsapp");
    expect(parseCheckoutMode("card")).toBe("whatsapp");
  });
});
