import { ErrorCode } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import type { Failure } from "../auth-errors";
import { couponFailureMessage, isCouponRuleFailure, normalizeCouponInput } from "./coupon-errors";

function failure(overrides: Partial<Failure>): Failure {
  return { kind: "conflict", message: "mensaje del API", fieldErrors: {}, ...overrides };
}

describe("normalizeCouponInput", () => {
  it("recorta espacios y pasa a mayúsculas", () => {
    expect(normalizeCouponInput("  bienvenida10 ")).toBe("BIENVENIDA10");
  });

  it("vacío o solo espacios queda vacío", () => {
    expect(normalizeCouponInput("   ")).toBe("");
  });
});

describe("couponFailureMessage", () => {
  it("un fallo de cupón muestra el mensaje del API tal cual, ya en español", () => {
    for (const code of [ErrorCode.COUPON_INVALID, ErrorCode.COUPON_EXPIRED, ErrorCode.COUPON_EXHAUSTED, ErrorCode.COUPON_ALREADY_USED, ErrorCode.COUPON_MIN_NOT_MET]) {
      expect(couponFailureMessage(failure({ code, message: "Este cupón ya venció." }))).toBe("Este cupón ya venció.");
    }
  });

  it("sesión vencida pide iniciar sesión otra vez", () => {
    expect(couponFailureMessage(failure({ kind: "unauthorized", status: 401 }))).toMatch(/inicia sesión/i);
  });

  it("un carrito con algo agotado lo dice sin culpar al cupón", () => {
    expect(couponFailureMessage(failure({ code: ErrorCode.ITEM_UNAVAILABLE, message: "Algo se agotó." }))).toBe("Algo se agotó.");
  });

  it("límite de intentos, red y servidor conservan su mensaje", () => {
    expect(couponFailureMessage(failure({ kind: "rateLimited", status: 429, message: "Demasiados intentos con cupones." }))).toBe("Demasiados intentos con cupones.");
    expect(couponFailureMessage(failure({ kind: "network", message: "Sin red" }))).toBe("Sin red");
    expect(couponFailureMessage(failure({ kind: "server", status: 500, message: "Algo salió mal" }))).toBe("Algo salió mal");
  });

  it("un 400 (código vacío) pide escribir el código", () => {
    expect(couponFailureMessage(failure({ kind: "invalid", status: 400, message: "Datos inválidos" }))).toBe("Escribe el código de tu cupón.");
  });
});

describe("isCouponRuleFailure", () => {
  it("solo las reglas del cupón lo dan por muerto: vencido, agotado, ya usado, mínimo o inválido", () => {
    for (const code of [ErrorCode.COUPON_INVALID, ErrorCode.COUPON_EXPIRED, ErrorCode.COUPON_EXHAUSTED, ErrorCode.COUPON_ALREADY_USED, ErrorCode.COUPON_MIN_NOT_MET]) {
      expect(isCouponRuleFailure(failure({ code }))).toBe(true);
    }
  });

  it("red caída, servidor, límite de intentos, sesión y artículo agotado NO invalidan un cupón ya aplicado", () => {
    expect(isCouponRuleFailure(failure({ kind: "network" }))).toBe(false);
    expect(isCouponRuleFailure(failure({ kind: "server", status: 500 }))).toBe(false);
    expect(isCouponRuleFailure(failure({ kind: "rateLimited", status: 429 }))).toBe(false);
    expect(isCouponRuleFailure(failure({ kind: "unauthorized", status: 401 }))).toBe(false);
    expect(isCouponRuleFailure(failure({ code: ErrorCode.ITEM_UNAVAILABLE }))).toBe(false);
  });
});
