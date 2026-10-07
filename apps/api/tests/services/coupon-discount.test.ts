import { describe, expect, it } from "vitest";
import { CouponDiscountType } from "@esencia-glow/shared";
import { computeCouponDiscount } from "../../src/services/coupon-discount.js";

describe("services/coupon-discount", () => {
  it("calcula el porcentaje sobre el subtotal y redondea al centavo", () => {
    expect(
      computeCouponDiscount({ discountType: CouponDiscountType.PERCENT, percentOff: 15, subtotalCents: 80000 }),
    ).toBe(12000);
    // 10% de 33333 = 3333.3 → 3333
    expect(
      computeCouponDiscount({ discountType: CouponDiscountType.PERCENT, percentOff: 10, subtotalCents: 33333 }),
    ).toBe(3333);
  });

  it("el monto fijo descuenta exactamente ese monto", () => {
    expect(
      computeCouponDiscount({ discountType: CouponDiscountType.FIXED, amountOffCents: 10000, subtotalCents: 80000 }),
    ).toBe(10000);
  });

  it("el monto fijo nunca descuenta más que el subtotal", () => {
    expect(
      computeCouponDiscount({ discountType: CouponDiscountType.FIXED, amountOffCents: 50000, subtotalCents: 30000 }),
    ).toBe(30000);
  });

  it("100% descuenta todo el subtotal y no más", () => {
    expect(
      computeCouponDiscount({ discountType: CouponDiscountType.PERCENT, percentOff: 100, subtotalCents: 45050 }),
    ).toBe(45050);
  });

  it("un subtotal de 0 da descuento 0", () => {
    expect(
      computeCouponDiscount({ discountType: CouponDiscountType.PERCENT, percentOff: 20, subtotalCents: 0 }),
    ).toBe(0);
  });
});
