import { describe, expect, it } from "vitest";
import { mobileScreen, stepStatuses } from "./checkout-machine";

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

describe("mobileScreen", () => {
  it("sin sesión: cuenta", () => {
    expect(mobileScreen({ signedIn: false, quoteReady: false, confirmed: false })).toBe("account");
  });

  it("con sesión y sin cotización: dirección", () => {
    expect(mobileScreen({ signedIn: true, quoteReady: false, confirmed: false })).toBe("address");
  });

  it("con cotización lista y sin confirmar: paquetería", () => {
    expect(mobileScreen({ signedIn: true, quoteReady: true, confirmed: false })).toBe("rates");
  });

  it("con el envío confirmado: pago", () => {
    expect(mobileScreen({ signedIn: true, quoteReady: true, confirmed: true })).toBe("payment");
  });

  it("confirmado sin cotización vigente (pedido ya creado): pago", () => {
    expect(mobileScreen({ signedIn: true, quoteReady: false, confirmed: true })).toBe("payment");
  });

  it("una cotización sin sesión no habilita nada", () => {
    expect(mobileScreen({ signedIn: false, quoteReady: true, confirmed: true })).toBe("account");
  });
});
