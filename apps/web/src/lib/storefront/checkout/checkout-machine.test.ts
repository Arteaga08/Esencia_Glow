import { describe, expect, it } from "vitest";
import { stepStatuses } from "./checkout-machine";

describe("stepStatuses", () => {
  it("sin sesión: cuenta activa, envío y pago apagados", () => {
    expect(stepStatuses({ signedIn: false, hasRate: false })).toEqual({ account: "active", shipping: "upcoming", payment: "upcoming" });
  });

  it("con sesión y sin tarifa: cuenta lista, envío activo, pago apagado", () => {
    expect(stepStatuses({ signedIn: true, hasRate: false })).toEqual({ account: "done", shipping: "active", payment: "upcoming" });
  });

  it("con tarifa elegida: pago activo y envío queda como resumen", () => {
    expect(stepStatuses({ signedIn: true, hasRate: true })).toEqual({ account: "done", shipping: "done", payment: "active" });
  });

  it("una tarifa sin sesión no habilita nada (no puede pasar, pero no se rompe)", () => {
    expect(stepStatuses({ signedIn: false, hasRate: true })).toEqual({ account: "active", shipping: "upcoming", payment: "upcoming" });
  });
});
