import { ErrorCode } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import type { Failure } from "../auth-errors";
import { mapPlaceOrderFailure } from "./checkout-failures";

function failure(overrides: Partial<Failure>): Failure {
  return { kind: "conflict", message: "mensaje del API", fieldErrors: {}, ...overrides };
}

describe("mapPlaceOrderFailure", () => {
  it("cotización vencida o carrito cambiado: volver al envío a cotizar de nuevo", () => {
    expect(mapPlaceOrderFailure(failure({ code: ErrorCode.SHIPPING_QUOTE_INVALID })).action).toBe("requote");
    expect(mapPlaceOrderFailure(failure({ code: ErrorCode.CART_CHANGED })).action).toBe("requote");
  });

  it("algo ya no está disponible: volver al carrito", () => {
    expect(mapPlaceOrderFailure(failure({ code: ErrorCode.ITEM_UNAVAILABLE })).action).toBe("cart");
  });

  it("pedido pendiente: lleva el id para reanudar", () => {
    const mapped = mapPlaceOrderFailure(failure({ code: ErrorCode.PENDING_ORDER_EXISTS, fieldErrors: { orderId: "abc123" } }));
    expect(mapped).toMatchObject({ action: "resume", orderId: "abc123" });
  });

  it("pedido pendiente sin id utilizable cae en mensaje, no en reanudar a ciegas", () => {
    expect(mapPlaceOrderFailure(failure({ code: ErrorCode.PENDING_ORDER_EXISTS })).action).toBe("message");
  });

  it("límite de intentos, pagos apagados y red", () => {
    expect(mapPlaceOrderFailure(failure({ kind: "rateLimited", status: 429, message: "Demasiados intentos" })).action).toBe("message");
    expect(mapPlaceOrderFailure(failure({ kind: "server", status: 503, message: "Los pagos no están configurados." })).action).toBe("unavailable");
    expect(mapPlaceOrderFailure(failure({ kind: "network", message: "sin red" })).action).toBe("message");
  });

  it("decide por código, nunca por el texto del mensaje", () => {
    expect(mapPlaceOrderFailure(failure({ message: "Tu carrito cambió, vuelve a cotizar el envío." })).action).toBe("message");
  });

  it("conserva el mensaje del API para mostrarlo en español", () => {
    expect(mapPlaceOrderFailure(failure({ code: ErrorCode.CART_CHANGED, message: "Tu carrito cambió" })).message).toBe("Tu carrito cambió");
  });

  it("red, servidor y límite de intentos son reintentables; un 4xx definitivo no", () => {
    expect(mapPlaceOrderFailure(failure({ kind: "network" })).retryable).toBe(true);
    expect(mapPlaceOrderFailure(failure({ kind: "server", status: 502 })).retryable).toBe(true);
    expect(mapPlaceOrderFailure(failure({ kind: "rateLimited", status: 429 })).retryable).toBe(true);
    expect(mapPlaceOrderFailure(failure({ code: ErrorCode.CART_CHANGED })).retryable).toBe(false);
  });

  it("cualquier fallo de cupón quita el cupón y muestra el mensaje en su campo, sin mandar al carrito", () => {
    for (const code of [ErrorCode.COUPON_INVALID, ErrorCode.COUPON_EXPIRED, ErrorCode.COUPON_EXHAUSTED, ErrorCode.COUPON_ALREADY_USED, ErrorCode.COUPON_MIN_NOT_MET]) {
      expect(mapPlaceOrderFailure(failure({ code, message: "Este cupón ya venció." }))).toMatchObject({ action: "coupon", message: "Este cupón ya venció." });
    }
  });
});
