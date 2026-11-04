import { describe, expect, it } from "vitest";

// El módulo lee las variables al importarse: se fijan antes del import dinámico.
process.env.NEXT_PUBLIC_STORE_WHATSAPP = "526621234567";
process.env.NEXT_PUBLIC_ADVICE_WHATSAPP = "526629876543";

const { ADVICE_WHATSAPP_HREF, STORE_WHATSAPP_DISPLAY, STORE_WHATSAPP_HREF, parseWhatsappNumber } = await import("./contact");

describe("parseWhatsappNumber", () => {
  it("acepta 52 + 10 dígitos y recorta espacios", () => {
    expect(parseWhatsappNumber(" 526621234567 ", "X")).toBe("526621234567");
  });

  it.each([undefined, "", "6621234567", "52662123456", "+526621234567", "52 662 123 4567"])("rechaza %j", (raw) => {
    expect(() => parseWhatsappNumber(raw, "X")).toThrow(/X debe ser 52 \+ 10 dígitos/);
  });
});

describe("enlaces de WhatsApp", () => {
  it("usa cada número en su enlace y formatea el visible", () => {
    expect(STORE_WHATSAPP_HREF).toContain("https://wa.me/526621234567?text=");
    expect(ADVICE_WHATSAPP_HREF).toContain("https://wa.me/526629876543?text=");
    expect(STORE_WHATSAPP_DISPLAY).toBe("662 123 4567");
  });
});
