import mongoose from "mongoose";
import { ShippingCarrier, SubscriptionShipmentStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";

function buildShipmentAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    accountId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    planId: new mongoose.Types.ObjectId(),
    cycleYear: 2026,
    cycleMonth: 9,
    ...overrides,
  };
}

describe("models/SubscriptionShipment", () => {
  it("crea un envío válido, PENDING por default", async () => {
    const shipment = await SubscriptionShipment.create(buildShipmentAttrs());
    expect(shipment.status).toBe(SubscriptionShipmentStatus.PENDING);
    expect(shipment.editionIncident).toBe(false);
  });

  it("se crea válido SIN editionId, marcado como incidencia (decisión 8 del plan de 1.7.1)", async () => {
    const shipment = await SubscriptionShipment.create(buildShipmentAttrs({ editionIncident: true }));
    expect(shipment.editionId).toBeUndefined();
    expect(shipment.editionIncident).toBe(true);
  });

  it("rechaza dos envíos para la misma cuenta y el mismo ciclo (11000)", async () => {
    const accountId = new mongoose.Types.ObjectId();
    await SubscriptionShipment.create(buildShipmentAttrs({ accountId, cycleYear: 2026, cycleMonth: 9 }));

    await expect(
      SubscriptionShipment.create(buildShipmentAttrs({ accountId, cycleYear: 2026, cycleMonth: 9 })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rechaza un invoiceId duplicado entre dos envíos (idempotencia del webhook de renovación)", async () => {
    await SubscriptionShipment.create(buildShipmentAttrs({ invoiceId: "in_123" }));
    await expect(
      SubscriptionShipment.create(buildShipmentAttrs({ invoiceId: "in_123" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("dos envíos sin invoiceId conviven", async () => {
    await SubscriptionShipment.create(buildShipmentAttrs());
    await expect(SubscriptionShipment.create(buildShipmentAttrs())).resolves.toBeDefined();
  });

  it("reservedItems e inventoryIncident por default: array vacío, false (Milestone 1.7.2a)", async () => {
    const shipment = await SubscriptionShipment.create(buildShipmentAttrs());
    expect(shipment.reservedItems).toEqual([]);
    expect(shipment.inventoryIncident).toBe(false);
  });

  it("guarda el snapshot de lo reservado, para que 1.7.2b pueda comprometerlo al enviar", async () => {
    const variantId = new mongoose.Types.ObjectId();
    const shipment = await SubscriptionShipment.create(
      buildShipmentAttrs({ reservedItems: [{ variantId, quantity: 2 }], inventoryIncident: true }),
    );
    expect(shipment.reservedItems).toHaveLength(1);
    expect(shipment.reservedItems[0]?.variantId.toString()).toBe(variantId.toString());
    expect(shipment.reservedItems[0]?.quantity).toBe(2);
    expect(shipment.inventoryIncident).toBe(true);
  });

  it("rechaza una cantidad reservada no entera o menor a 1", async () => {
    const variantId = new mongoose.Types.ObjectId();
    await expect(
      SubscriptionShipment.create(buildShipmentAttrs({ reservedItems: [{ variantId, quantity: 0 }] })),
    ).rejects.toBeTruthy();
  });
});

describe("models/SubscriptionShipment — guía y sellos de envío (Milestone 1.7.2b)", () => {
  it("guarda la guía con una paquetería del vocabulario cerrado y los sellos de cada transición", async () => {
    const shipment = await SubscriptionShipment.create(
      buildShipmentAttrs({
        status: SubscriptionShipmentStatus.SHIPPED,
        carrier: ShippingCarrier.ESTAFETA,
        trackingNumber: "ES123456789MX",
        shippedAt: new Date("2026-09-20T10:00:00Z"),
        stockCommittedAt: new Date("2026-09-20T10:00:00Z"),
      }),
    );

    expect(shipment.carrier).toBe(ShippingCarrier.ESTAFETA);
    expect(shipment.trackingNumber).toBe("ES123456789MX");
    expect(shipment.shippedAt).toBeInstanceOf(Date);
    expect(shipment.stockCommittedAt).toBeInstanceOf(Date);
  });

  it("rechaza una paquetería fuera del enum: texto libre rompería la integración real de envíos", async () => {
    await expect(
      SubscriptionShipment.create(buildShipmentAttrs({ carrier: "mi-primo-con-una-moto" })),
    ).rejects.toBeTruthy();
  });

  it("acepta el estado canceled con su sello", async () => {
    const shipment = await SubscriptionShipment.create(
      buildShipmentAttrs({ status: SubscriptionShipmentStatus.CANCELED, canceledAt: new Date() }),
    );
    expect(shipment.status).toBe(SubscriptionShipmentStatus.CANCELED);
    expect(shipment.canceledAt).toBeInstanceOf(Date);
  });
});
