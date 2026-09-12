import { describe, expect, it } from "vitest";
import { OrderStatus } from "@esencia-glow/shared";
import {
  ALL_ORDER_STATUSES,
  ORDER_TRANSITIONS,
  REFUNDABLE_ORDER_STATUSES,
  canTransition,
  assertTransition,
  getTransitionInventoryEffect,
} from "../../src/services/order-state.js";

const VALID_PAIRS: [OrderStatus, OrderStatus, string[]][] = [
  [OrderStatus.PENDING, OrderStatus.PAID, ["system"]],
  [OrderStatus.PENDING, OrderStatus.CANCELLED, ["customer", "admin", "system"]],
  [OrderStatus.PAID, OrderStatus.PROCESSING, ["admin"]],
  [OrderStatus.PROCESSING, OrderStatus.SHIPPED, ["admin"]],
  [OrderStatus.SHIPPED, OrderStatus.DELIVERED, ["admin"]],
  [OrderStatus.PAID, OrderStatus.REFUNDED, ["system"]],
  [OrderStatus.PROCESSING, OrderStatus.REFUNDED, ["system"]],
  [OrderStatus.SHIPPED, OrderStatus.REFUNDED, ["system"]],
  [OrderStatus.DELIVERED, OrderStatus.REFUNDED, ["system"]],
];

const VALID_KEY = new Set(VALID_PAIRS.map(([from, to]) => `${from}->${to}`));

describe("services/order-state", () => {
  it("matriz completa 7x7: solo las transiciones declaradas son válidas", () => {
    for (const from of ALL_ORDER_STATUSES) {
      for (const to of ALL_ORDER_STATUSES) {
        const expected = VALID_KEY.has(`${from}->${to}`);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("canTransition(x, x) es siempre false — re-aplicar el estado no es una transición", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("cancelled y refunded son terminales: no tienen transición de salida", () => {
    for (const to of ALL_ORDER_STATUSES) {
      expect(canTransition(OrderStatus.CANCELLED, to)).toBe(false);
      expect(canTransition(OrderStatus.REFUNDED, to)).toBe(false);
    }
  });

  it("delivered NO es terminal: puede seguirle refunded", () => {
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.REFUNDED)).toBe(true);
  });

  it("assertTransition no lanza para una transición válida con el actor correcto", () => {
    expect(() =>
      assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED, "customer"),
    ).not.toThrow();
  });

  it("assertTransition lanza 409 para una transición inexistente en la tabla", () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.SHIPPED, "admin")).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it("admin no puede mover pending -> paid: eso lo decide únicamente el webhook", () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PAID, "admin")).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it("matriz de actores: cada transición válida solo permite a los actores declarados", () => {
    for (const [from, to, allowedActors] of VALID_PAIRS) {
      for (const actor of ["customer", "admin", "system"] as const) {
        if (allowedActors.includes(actor)) {
          expect(() => assertTransition(from, to, actor)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to, actor)).toThrowError(
            expect.objectContaining({ statusCode: 409 }),
          );
        }
      }
    }
  });

  it("mapa de efecto de inventario: pending->paid es commit", () => {
    expect(getTransitionInventoryEffect(OrderStatus.PENDING, OrderStatus.PAID)).toBe("commit");
  });

  it("mapa de efecto de inventario: pending->cancelled es release", () => {
    expect(getTransitionInventoryEffect(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe("release");
  });

  it("mapa de efecto de inventario: paid/processing ->refunded es restock (aún no se ha enviado)", () => {
    expect(getTransitionInventoryEffect(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe("restock");
    expect(getTransitionInventoryEffect(OrderStatus.PROCESSING, OrderStatus.REFUNDED)).toBe("restock");
  });

  it("mapa de efecto de inventario: shipped/delivered ->refunded es 'none' (decisión 3 de 1.6, sin restock automático — el admin ajusta a mano)", () => {
    expect(getTransitionInventoryEffect(OrderStatus.SHIPPED, OrderStatus.REFUNDED)).toBe("none");
    expect(getTransitionInventoryEffect(OrderStatus.DELIVERED, OrderStatus.REFUNDED)).toBe("none");
  });

  it("mapa de efecto de inventario: transiciones administrativas sin efecto son 'none'", () => {
    expect(getTransitionInventoryEffect(OrderStatus.PAID, OrderStatus.PROCESSING)).toBe("none");
    expect(getTransitionInventoryEffect(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe("none");
    expect(getTransitionInventoryEffect(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe("none");
  });

  it("REFUNDABLE_ORDER_STATUSES: exactamente los estados con una arista hacia refunded (paid/processing/shipped/delivered) — fuente única para order-refund*.service.ts", () => {
    expect([...REFUNDABLE_ORDER_STATUSES].sort()).toEqual(
      [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED].sort(),
    );
  });

  it("ORDER_TRANSITIONS es exhaustivo: tiene una entrada para cada OrderStatus", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[status]).toBeDefined();
    }
  });
});
