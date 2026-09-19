import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { ShippingCarrier, SubscriptionAction, SubscriptionShipmentStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";
import { createCycleShipment } from "../../src/services/subscription-shipment.service.js";
import { changeShipmentStatus } from "../../src/services/subscription-shipment-admin.service.js";
import {
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscribedAccount,
  seedSubscriptionVariantWithStock,
} from "../helpers/subscription-fixtures.js";

/**
 * Transiciones del envío desde el panel (Milestone 1.7.2b, Fase 3). El
 * inventario se COMPROMETE al enviar (`reserved -> onHand`, ambos bajan) y
 * se LIBERA al cancelar — "reserva al cobrar, salida al enviar".
 *
 * Los envíos se construyen con `createCycleShipment` real (no
 * `SubscriptionShipment.create` a mano): así `reservedItems` y el
 * `Inventory.reserved` de verdad quedan exactamente como los dejó el cobro.
 */

const CYCLE = { year: 2026, month: 9 };
// A mitad de mes a propósito: `resolveCycleFromDate` traduce a la zona del
// negocio (America/Mexico_City), así que un `2026-09-01T00:00:00Z` caería en
// el ciclo de AGOSTO y la edición sembrada para septiembre no se encontraría.
const PERIOD_START = new Date("2026-09-15T12:00:00Z");

async function seedShipmentWithReservation(quantity = 2, onHand = 10) {
  const plan = await seedPlanWithStripeRefs();
  const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand });
  await seedPublishedEdition({
    planId: plan._id.toString(),
    cycleYear: CYCLE.year,
    cycleMonth: CYCLE.month,
    items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity }],
  });
  const account = await seedSubscribedAccount({
    planId: plan._id.toString(),
    status: SubscriptionStatus.ACTIVE,
  });
  const result = await createCycleShipment({
    accountId: account._id,
    userId: account.userId,
    planId: plan._id,
    invoiceRef: `in_${new Types.ObjectId().toString()}`,
    servicePeriodStart: PERIOD_START,
  });
  return { shipment: result.shipment, variantId, quantity, onHand };
}

describe("services/subscription-shipment-admin — ciclo completo del envío", () => {
  it("pending -> processing no mueve el inventario: la caja sigue apartada", async () => {
    const { shipment, variantId, quantity, onHand } = await seedShipmentWithReservation();

    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.PROCESSING,
      actor: "admin",
    });

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(onHand);
    expect(inventory?.reserved).toBe(quantity);
    const reloaded = await SubscriptionShipment.findById(shipment._id);
    expect(reloaded?.status).toBe(SubscriptionShipmentStatus.PROCESSING);
    expect(reloaded?.stockCommittedAt).toBeUndefined();
  });

  it("processing -> shipped compromete el stock y sella la guía", async () => {
    const { shipment, variantId, quantity, onHand } = await seedShipmentWithReservation();
    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.PROCESSING,
      actor: "admin",
    });

    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.SHIPPED,
      actor: "admin",
      carrier: ShippingCarrier.ESTAFETA,
      trackingNumber: "ES123456789MX",
    });

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(onHand - quantity);
    expect(inventory?.reserved).toBe(0);

    const reloaded = await SubscriptionShipment.findById(shipment._id);
    expect(reloaded?.status).toBe(SubscriptionShipmentStatus.SHIPPED);
    expect(reloaded?.carrier).toBe(ShippingCarrier.ESTAFETA);
    expect(reloaded?.trackingNumber).toBe("ES123456789MX");
    expect(reloaded?.shippedAt).toBeInstanceOf(Date);
    expect(reloaded?.stockCommittedAt).toBeInstanceOf(Date);
  });

  it("shipped -> delivered no vuelve a tocar el inventario", async () => {
    const { shipment, variantId, quantity, onHand } = await seedShipmentWithReservation();
    for (const to of [SubscriptionShipmentStatus.PROCESSING, SubscriptionShipmentStatus.SHIPPED]) {
      await changeShipmentStatus({
        shipmentId: shipment._id.toString(),
        to,
        actor: "admin",
        carrier: ShippingCarrier.ESTAFETA,
        trackingNumber: "ES123456789MX",
      });
    }

    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.DELIVERED,
      actor: "admin",
    });

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(onHand - quantity);
    expect(inventory?.reserved).toBe(0);
    const reloaded = await SubscriptionShipment.findById(shipment._id);
    expect(reloaded?.deliveredAt).toBeInstanceOf(Date);
  });

  it("pending -> canceled devuelve la reserva: onHand intacto, reserved en cero", async () => {
    const { shipment, variantId, onHand } = await seedShipmentWithReservation();

    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.CANCELED,
      actor: "admin",
    });

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(onHand);
    expect(inventory?.reserved).toBe(0);
    const reloaded = await SubscriptionShipment.findById(shipment._id);
    expect(reloaded?.status).toBe(SubscriptionShipmentStatus.CANCELED);
    expect(reloaded?.canceledAt).toBeInstanceOf(Date);
  });

  it("audita la transición con metadata.from/to", async () => {
    const { shipment } = await seedShipmentWithReservation();

    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.PROCESSING,
      actor: "admin",
    });

    const log = await AuditLog.findOne({
      action: SubscriptionAction.SHIPMENT_STATUS_CHANGED,
      targetId: shipment._id,
    });
    expect(log?.metadata).toMatchObject({
      from: SubscriptionShipmentStatus.PENDING,
      to: SubscriptionShipmentStatus.PROCESSING,
    });
  });
});

describe("services/subscription-shipment-admin — guardas", () => {
  it("una transición inexistente responde 409 y no toca el inventario", async () => {
    const { shipment, variantId, quantity, onHand } = await seedShipmentWithReservation();

    await expect(
      changeShipmentStatus({
        shipmentId: shipment._id.toString(),
        to: SubscriptionShipmentStatus.DELIVERED,
        actor: "admin",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(onHand);
    expect(inventory?.reserved).toBe(quantity);
  });

  it("marcar shipped sin guía es 400: la caja no sale sin número de rastreo", async () => {
    const { shipment } = await seedShipmentWithReservation();
    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.PROCESSING,
      actor: "admin",
    });

    await expect(
      changeShipmentStatus({
        shipmentId: shipment._id.toString(),
        to: SubscriptionShipmentStatus.SHIPPED,
        actor: "admin",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("un envío inexistente responde 404", async () => {
    await expect(
      changeShipmentStatus({
        shipmentId: new Types.ObjectId().toString(),
        to: SubscriptionShipmentStatus.PROCESSING,
        actor: "admin",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("services/subscription-shipment-admin — concurrencia real", () => {
  it("dos envíos simultáneos del MISMO shipment: uno gana y el stock se descuenta UNA sola vez", async () => {
    const { shipment, variantId, quantity, onHand } = await seedShipmentWithReservation();
    await changeShipmentStatus({
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.PROCESSING,
      actor: "admin",
    });

    const input = {
      shipmentId: shipment._id.toString(),
      to: SubscriptionShipmentStatus.SHIPPED,
      actor: "admin" as const,
      carrier: ShippingCarrier.ESTAFETA,
      trackingNumber: "ES123456789MX",
    };
    const results = await Promise.allSettled([changeShipmentStatus(input), changeShipmentStatus(input)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(onHand - quantity);
    expect(inventory?.reserved).toBe(0);
  });
});
