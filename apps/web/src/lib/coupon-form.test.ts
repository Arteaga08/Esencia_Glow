import { CouponDiscountType } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { EMPTY_COUPON_FORM, pesosToCents, toCouponInput, type CouponFormValues } from "./coupon-form";

function values(overrides: Partial<CouponFormValues> = {}): CouponFormValues {
  return { ...EMPTY_COUPON_FORM, code: "BIENVENIDA10", discountType: CouponDiscountType.PERCENT, value: "10", ...overrides };
}

describe("pesosToCents", () => {
  it("convierte pesos escritos a centavos enteros", () => {
    expect(pesosToCents("100")).toBe(10000);
    expect(pesosToCents("100.5")).toBe(10050);
    expect(pesosToCents("1,250.00")).toBe(125000);
    expect(pesosToCents("$80")).toBe(8000);
    expect(pesosToCents(" 0.99 ")).toBe(99);
  });

  it("lo que no es un monto válido da null", () => {
    for (const bad of ["", "   ", "abc", "10.999", "-5", "1.2.3", "10 pesos"]) expect(pesosToCents(bad)).toBeNull();
  });
});

describe("toCouponInput", () => {
  it("porcentaje: manda solo el porcentaje y omite lo que quedó en blanco", () => {
    const result = toCouponInput(values({ description: "Primera compra", maxCustomers: "100" }));
    expect(result).toEqual({
      ok: true,
      input: { code: "BIENVENIDA10", description: "Primera compra", discountType: "percent", percentOff: 10, maxCustomers: 100, perCustomerLimit: 1 },
    });
  });

  it("monto fijo: convierte pesos a centavos y manda el mínimo de compra", () => {
    const result = toCouponInput(values({ discountType: CouponDiscountType.FIXED, value: "100", minSubtotal: "800" }));
    expect(result.ok && result.input).toMatchObject({ discountType: CouponDiscountType.FIXED, amountOffCents: 10000, minSubtotalCents: 80000 });
    expect(result.ok && result.input).not.toHaveProperty("percentOff");
  });

  it("las fechas van a la hora de México: inicio a las 00:00 y fin a las 23:59", () => {
    const result = toCouponInput(values({ startsAt: "2026-11-01", endsAt: "2026-11-30" }));
    expect(result.ok && result.input).toMatchObject({ startsAt: "2026-11-01T00:00:00-06:00", endsAt: "2026-11-30T23:59:59-06:00" });
  });

  it("recorta el código y no manda campos vacíos", () => {
    const result = toCouponInput(values({ code: "  gracias15 ", description: "  " }));
    expect(result.ok && result.input.code).toBe("gracias15");
    expect(result.ok && result.input).not.toHaveProperty("description");
    expect(result.ok && result.input).not.toHaveProperty("startsAt");
    expect(result.ok && result.input).not.toHaveProperty("minSubtotalCents");
  });

  it("usos por clienta en blanco queda en 1", () => {
    const result = toCouponInput(values({ perCustomerLimit: "" }));
    expect(result.ok && result.input.perCustomerLimit).toBe(1);
  });

  it("un valor que no es número da el error pegado al campo, en lenguaje humano", () => {
    expect(toCouponInput(values({ value: "diez" }))).toEqual({ ok: false, errors: { percentOff: "Escribe el porcentaje de descuento, solo números." } });
    expect(toCouponInput(values({ discountType: CouponDiscountType.FIXED, value: "" }))).toEqual({ ok: false, errors: { amountOffCents: "Escribe el monto del descuento en pesos, por ejemplo 100 o 99.50." } });
    expect(toCouponInput(values({ minSubtotal: "mucho" }))).toMatchObject({ ok: false, errors: { minSubtotalCents: expect.any(String) } });
    expect(toCouponInput(values({ maxCustomers: "x" }))).toMatchObject({ ok: false, errors: { maxCustomers: expect.any(String) } });
    expect(toCouponInput(values({ perCustomerLimit: "1.5" }))).toMatchObject({ ok: false, errors: { perCustomerLimit: expect.any(String) } });
  });

  it("junta todos los errores a la vez, no solo el primero", () => {
    const result = toCouponInput(values({ value: "x", minSubtotal: "y" }));
    expect(result.ok === false && Object.keys(result.errors).sort()).toEqual(["minSubtotalCents", "percentOff"]);
  });

  it("para dar un cupón personal no manda el tope de personas", () => {
    const result = toCouponInput(values({ maxCustomers: "50" }), { personal: true });
    expect(result.ok && result.input).not.toHaveProperty("maxCustomers");
  });
});
