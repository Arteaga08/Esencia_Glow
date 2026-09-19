import { describe, expect, it } from "vitest";
import { SubscriptionShipmentStatus } from "@esencia-glow/shared";
import { AppError } from "../../src/utils/app-error.js";
import {
  assertShipmentTransition,
  canShipmentTransition,
  shipmentStockEffect,
} from "../../src/services/subscription-shipment-state.js";

/**
 * Máquina de estados del envío del ciclo (Milestone 1.7.2b, Fase 1) —
 * módulo puro sin I/O, calcado de subscription-state.ts. El efecto sobre el
 * inventario se DERIVA del conjunto de estados que retienen stock, nunca de
 * una segunda tabla escrita a mano.
 */

describe("services/subscription-shipment-state — transiciones", () => {
  it("avanza pending -> processing -> shipped -> delivered", () => {
    expect(canShipmentTransition(SubscriptionShipmentStatus.PENDING, SubscriptionShipmentStatus.PROCESSING, "admin")).toBe(true);
    expect(canShipmentTransition(SubscriptionShipmentStatus.PROCESSING, SubscriptionShipmentStatus.SHIPPED, "admin")).toBe(true);
    expect(canShipmentTransition(SubscriptionShipmentStatus.SHIPPED, SubscriptionShipmentStatus.DELIVERED, "admin")).toBe(true);
  });

  it("permite cancelar desde pending y desde processing, nunca después de enviar", () => {
    expect(canShipmentTransition(SubscriptionShipmentStatus.PENDING, SubscriptionShipmentStatus.CANCELED, "admin")).toBe(true);
    expect(canShipmentTransition(SubscriptionShipmentStatus.PROCESSING, SubscriptionShipmentStatus.CANCELED, "admin")).toBe(true);
    expect(canShipmentTransition(SubscriptionShipmentStatus.SHIPPED, SubscriptionShipmentStatus.CANCELED, "admin")).toBe(false);
  });

  it("no retrocede: processing -> pending no existe", () => {
    expect(canShipmentTransition(SubscriptionShipmentStatus.PROCESSING, SubscriptionShipmentStatus.PENDING, "admin")).toBe(false);
  });

  it("delivered y canceled son terminales", () => {
    for (const to of Object.values(SubscriptionShipmentStatus)) {
      expect(canShipmentTransition(SubscriptionShipmentStatus.DELIVERED, to, "admin")).toBe(false);
      expect(canShipmentTransition(SubscriptionShipmentStatus.CANCELED, to, "admin")).toBe(false);
    }
  });

  it("re-aplicar el mismo estado nunca es una transición", () => {
    for (const status of Object.values(SubscriptionShipmentStatus)) {
      expect(canShipmentTransition(status, status, "admin")).toBe(false);
    }
  });

  it("assertShipmentTransition lanza 409 para una transición inexistente", () => {
    expect(() =>
      assertShipmentTransition(SubscriptionShipmentStatus.DELIVERED, SubscriptionShipmentStatus.PENDING, "admin"),
    ).toThrowError(AppError);
    try {
      assertShipmentTransition(SubscriptionShipmentStatus.DELIVERED, SubscriptionShipmentStatus.PENDING, "admin");
    } catch (error) {
      expect((error as AppError).statusCode).toBe(409);
    }
  });
});

describe("services/subscription-shipment-state — efecto sobre el inventario", () => {
  it("salir hacia shipped compromete el stock reservado", () => {
    expect(shipmentStockEffect(SubscriptionShipmentStatus.PROCESSING, SubscriptionShipmentStatus.SHIPPED)).toBe("commit");
  });

  it("cancelar libera la reserva, desde cualquiera de los dos estados que la retienen", () => {
    expect(shipmentStockEffect(SubscriptionShipmentStatus.PENDING, SubscriptionShipmentStatus.CANCELED)).toBe("release");
    expect(shipmentStockEffect(SubscriptionShipmentStatus.PROCESSING, SubscriptionShipmentStatus.CANCELED)).toBe("release");
  });

  it("preparar no mueve inventario, y entregar tampoco: el stock ya salió al enviar", () => {
    expect(shipmentStockEffect(SubscriptionShipmentStatus.PENDING, SubscriptionShipmentStatus.PROCESSING)).toBe("none");
    expect(shipmentStockEffect(SubscriptionShipmentStatus.SHIPPED, SubscriptionShipmentStatus.DELIVERED)).toBe("none");
  });
});
