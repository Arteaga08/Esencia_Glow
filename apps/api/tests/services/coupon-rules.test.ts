import { describe, expect, it } from "vitest";
import { CouponKind, ErrorCode } from "@esencia-glow/shared";
import { AppError } from "../../src/utils/app-error.js";
import { assertCouponApplicable, type CouponRuleInput } from "../../src/services/coupon-rules.js";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const USER = "665f1f77bcf86cd799439011";

function coupon(overrides: Partial<CouponRuleInput> = {}): CouponRuleInput {
  return {
    kind: CouponKind.PUBLIC,
    isActive: true,
    ...overrides,
  };
}

function codeOf(fn: () => void): ErrorCode | undefined {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return (error as AppError).code;
  }
  return undefined;
}

const ctx = { userId: USER, subtotalCents: 100000, now: NOW };

describe("services/coupon-rules", () => {
  it("acepta un cupón público vigente sin condiciones", () => {
    expect(() => assertCouponApplicable(coupon(), ctx)).not.toThrow();
  });

  it("rechaza un cupón desactivado como inválido", () => {
    expect(codeOf(() => assertCouponApplicable(coupon({ isActive: false }), ctx))).toBe(ErrorCode.COUPON_INVALID);
  });

  it("rechaza un cupón que todavía no empieza como inválido (no revela que existe)", () => {
    const startsAt = new Date("2026-10-11T00:00:00.000Z");
    expect(codeOf(() => assertCouponApplicable(coupon({ startsAt }), ctx))).toBe(ErrorCode.COUPON_INVALID);
  });

  it("rechaza un cupón vencido con su propio código", () => {
    const endsAt = new Date("2026-10-09T23:59:59.000Z");
    expect(codeOf(() => assertCouponApplicable(coupon({ endsAt }), ctx))).toBe(ErrorCode.COUPON_EXPIRED);
  });

  it("acepta justo en el instante de fin y en el de inicio", () => {
    expect(() => assertCouponApplicable(coupon({ endsAt: NOW }), ctx)).not.toThrow();
    expect(() => assertCouponApplicable(coupon({ startsAt: NOW }), ctx)).not.toThrow();
  });

  it("un cupón personal de otra clienta es inválido, igual que uno inexistente", () => {
    const personal = coupon({ kind: CouponKind.PERSONAL, assignedUserId: "665f1f77bcf86cd799439099" });
    expect(codeOf(() => assertCouponApplicable(personal, ctx))).toBe(ErrorCode.COUPON_INVALID);
  });

  it("un cupón personal lo acepta su dueña", () => {
    const personal = coupon({ kind: CouponKind.PERSONAL, assignedUserId: USER });
    expect(() => assertCouponApplicable(personal, ctx)).not.toThrow();
  });

  it("rechaza si el subtotal no alcanza el mínimo, y acepta si lo iguala", () => {
    expect(codeOf(() => assertCouponApplicable(coupon({ minSubtotalCents: 100001 }), ctx))).toBe(
      ErrorCode.COUPON_MIN_NOT_MET,
    );
    expect(() => assertCouponApplicable(coupon({ minSubtotalCents: 100000 }), ctx)).not.toThrow();
  });

  it("el mensaje del mínimo dice cuánto falta, en pesos", () => {
    try {
      assertCouponApplicable(coupon({ minSubtotalCents: 80000 }), { ...ctx, subtotalCents: 50000 });
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).message).toContain("$800.00");
    }
  });
});
