import { describe, expect, it } from "vitest";
import { generateOrderNumber, ORDER_NUMBER_PATTERN } from "../../src/services/order-number.js";

describe("services/order-number", () => {
  it("genera un folio con el prefijo EG- y el patrón esperado", () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(ORDER_NUMBER_PATTERN);
    expect(orderNumber.startsWith("EG-")).toBe(true);
  });

  it("el alfabeto excluye caracteres ambiguos por teléfono: I, O, 0, 1", () => {
    for (let i = 0; i < 500; i++) {
      const orderNumber = generateOrderNumber();
      const body = orderNumber.slice(3);
      expect(body).not.toMatch(/[IO01]/);
    }
  });

  it("no usa un contador compartido: dos llamadas seguidas casi nunca coinciden", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(generateOrderNumber());
    }
    // con 200 folios generados con aleatoriedad real, las colisiones deben
    // ser prácticamente inexistentes
    expect(seen.size).toBe(200);
  });
});
