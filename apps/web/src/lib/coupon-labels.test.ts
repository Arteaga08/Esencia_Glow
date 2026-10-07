import { CouponDiscountType, CouponKind, type AdminCoupon } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { couponStatus, describeCouponDiscount, describeCouponUsage, describeCouponValidity } from "./coupon-labels";

const NOW = new Date("2026-10-10T12:00:00.000Z");

function coupon(overrides: Partial<AdminCoupon> = {}): AdminCoupon {
  return {
    id: "c1",
    code: "BIENVENIDA10",
    kind: CouponKind.PUBLIC,
    description: "",
    discountType: CouponDiscountType.PERCENT,
    percentOff: 15,
    isActive: true,
    perCustomerLimit: 1,
    customersCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("describeCouponDiscount", () => {
  it("porcentaje y monto fijo", () => {
    expect(describeCouponDiscount(coupon())).toBe("15 %");
    expect(describeCouponDiscount(coupon({ discountType: CouponDiscountType.FIXED, percentOff: undefined, amountOffCents: 10000 }))).toBe("$100.00");
  });

  it("con compra mínima la dice", () => {
    expect(describeCouponDiscount(coupon({ minSubtotalCents: 80000 }))).toBe("15 % · desde $800.00");
  });
});

describe("describeCouponUsage", () => {
  it("con tope de personas muestra cuántas de cuántas", () => {
    expect(describeCouponUsage(coupon({ maxCustomers: 100, customersCount: 3 }))).toBe("3 de 100 personas");
  });

  it("sin tope solo cuenta", () => {
    expect(describeCouponUsage(coupon({ customersCount: 1 }))).toBe("1 persona");
    expect(describeCouponUsage(coupon({ customersCount: 3 }))).toBe("3 personas");
    expect(describeCouponUsage(coupon({ customersCount: 0 }))).toBe("0 personas");
  });

  it("uno personal dice si ya se usó", () => {
    expect(describeCouponUsage(coupon({ kind: CouponKind.PERSONAL, maxCustomers: 1, customersCount: 0 }))).toBe("Sin usar");
    expect(describeCouponUsage(coupon({ kind: CouponKind.PERSONAL, maxCustomers: 1, customersCount: 1 }))).toBe("Canjeado");
  });
});

describe("describeCouponValidity", () => {
  it("sin fechas no vence", () => {
    expect(describeCouponValidity(coupon())).toBe("Sin vencimiento");
  });

  it("solo inicio, solo fin y ambos", () => {
    expect(describeCouponValidity(coupon({ startsAt: "2026-11-01T06:00:00.000Z" }))).toMatch(/^Desde /);
    expect(describeCouponValidity(coupon({ endsAt: "2026-11-30T05:59:59.000Z" }))).toMatch(/^Hasta /);
    expect(describeCouponValidity(coupon({ startsAt: "2026-11-01T06:00:00.000Z", endsAt: "2026-11-30T05:59:59.000Z" }))).toContain("–");
  });
});

describe("couponStatus", () => {
  it("activo por defecto", () => {
    expect(couponStatus(coupon(), NOW)).toEqual({ label: "Activo", color: "success" });
  });

  it("desactivado manda sobre todo lo demás", () => {
    expect(couponStatus(coupon({ isActive: false, endsAt: "2026-01-01T00:00:00.000Z" }), NOW).label).toBe("Inactivo");
  });

  it("vencido, programado y agotado", () => {
    expect(couponStatus(coupon({ endsAt: "2026-10-09T00:00:00.000Z" }), NOW)).toEqual({ label: "Vencido", color: "neutral" });
    expect(couponStatus(coupon({ startsAt: "2026-10-20T00:00:00.000Z" }), NOW)).toEqual({ label: "Programado", color: "info" });
    expect(couponStatus(coupon({ maxCustomers: 5, customersCount: 5 }), NOW)).toEqual({ label: "Agotado", color: "warning" });
  });
});
