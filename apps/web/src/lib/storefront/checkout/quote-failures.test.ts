import { ErrorCode } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import type { Failure } from "../auth-errors";
import { classifyQuoteFailure } from "./quote-failures";

function failure(overrides: Partial<Failure>): Failure {
  return { kind: "server", message: "mensaje", fieldErrors: {}, ...overrides };
}

describe("classifyQuoteFailure", () => {
  it("sin opciones para esa dirección (422) es un estado propio, no un error", () => {
    expect(classifyQuoteFailure(failure({ status: 422, message: "No hay opciones de envío para esta dirección." }))).toEqual({
      status: "empty",
      message: "No hay opciones de envío para esta dirección.",
    });
  });

  it("algo del carrito ya no se vende", () => {
    expect(classifyQuoteFailure(failure({ kind: "conflict", status: 409, code: ErrorCode.ITEM_UNAVAILABLE })).status).toBe("unavailable");
  });

  it("errores por campo del API vuelven pegados a su campo", () => {
    const result = classifyQuoteFailure(failure({ kind: "invalid", status: 400, fieldErrors: { postalCode: "El código postal debe tener 5 dígitos" } }));
    expect(result).toMatchObject({ status: "invalid", errors: { postalCode: "El código postal debe tener 5 dígitos" } });
  });

  it("sesión vencida pide refrescar la sesión", () => {
    expect(classifyQuoteFailure(failure({ kind: "unauthorized", status: 401 })).status).toBe("unauthorized");
  });

  it("paquetería lenta o caída (502/503/504) y red son errores con reintento", () => {
    for (const status of [502, 503, 504]) expect(classifyQuoteFailure(failure({ status })).status).toBe("error");
    expect(classifyQuoteFailure(failure({ kind: "network" })).status).toBe("error");
  });
});
