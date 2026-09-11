import { InventoryAction, OrderStatus, PaymentState } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Product } from "../../src/models/product.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { createOrder } from "../../src/services/order.service.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedBundleWithStock,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

describe("services/order — createOrder", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("crea una orden pending con snapshot, reserva y totales calculados en el servidor", async () => {
    const { variantId, sku } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines);

    const { order, replay } = await createOrder(input);

    expect(replay).toBe(false);
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.orderNumber).toMatch(/^EG-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]!.sku).toBe(sku);
    expect(order.lines[0]!.unitPriceCents).toBe(50000);
    expect(order.lines[0]!.lineTotalCents).toBe(100000);
    expect(order.subtotalCents).toBe(100000);
    expect(order.payment.state).toBe(PaymentState.PENDING);
    expect(order.termsAcceptedAt).toBeInstanceOf(Date);
    expect(order.idempotencyKey).toBe(input.idempotencyKey);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(2);

    const reservation = await StockReservation.findById(order.reservationId);
    expect(reservation).not.toBeNull();
    // Milestone 1.6: reservation.expiresAt = order.expiresAt + margen de
    // seguridad (RESERVATION_SAFETY_MARGIN_MINUTES) — el cierre "Stripe-first"
    // debe actuar antes que el barrendero ciego de reservas, cambio
    // intencional respecto al `===` de 1.5 (ver plan de 1.6 §D).
    expect(reservation!.expiresAt.getTime()).toBe(order.expiresAt!.getTime() + 15 * 60_000);
  });

  it("audita RESERVATION_CREATED (emisor pendiente de 1.4, conectado en 1.5 desde el checkout)", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines);

    const { order } = await createOrder(input);

    const entry = await AuditLog.findOne({ action: InventoryAction.RESERVATION_CREATED, targetId: order.reservationId });
    expect(entry).not.toBeNull();
  });

  it("la orden es un snapshot inmutable: cambiar el precio del catálogo después no la altera", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines);

    const { order } = await createOrder(input);

    await Product.updateOne({ "variants._id": variantId }, { $set: { "variants.$.price": 999999 } });

    const reloaded = await Order.findById(order._id);
    expect(reloaded!.lines[0]!.unitPriceCents).toBe(50000);
    expect(reloaded!.subtotalCents).toBe(50000);
  });

  it("una variante inactiva rechaza con 409 y no deja rastro: ni Order ni reserva", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines);

    await Product.updateOne({ "variants._id": variantId }, { $set: { "variants.$.isActive": false } });

    await expect(createOrder(input)).rejects.toMatchObject({ statusCode: 409 });

    expect(await Order.countDocuments({ userId })).toBe(0);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("una línea de bundle cobra el precio del bundle y snapshotea sus componentes", async () => {
    const { bundle, variantId } = await seedBundleWithStock(50000, 89900);
    const userId = randomUserId();
    const lines = [{ itemType: "bundle" as const, itemId: bundle._id.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines);

    const { order } = await createOrder(input);

    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]!.itemType).toBe("bundle");
    expect(order.lines[0]!.unitPriceCents).toBe(89900);
    expect(order.lines[0]!.lineTotalCents).toBe(89900);
    expect(order.lines[0]!.components).toHaveLength(1);
    expect(order.lines[0]!.components![0]!.catalogUnitPriceCents).toBe(50000);
    expect(order.subtotalCents).toBe(89900);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(2);
  });

  it("sin stock suficiente, la orden se rechaza y no queda ninguna reserva a medias", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 1 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 5 }];
    const input = await buildCreateOrderInput(userId, lines);

    await expect(createOrder(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(await Order.countDocuments({ userId })).toBe(0);
  });

  it("rechaza sin termsAccepted", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines, { termsAccepted: false });

    await expect(createOrder(input)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("un rateId de otro usuario/ajeno se rechaza y no crea nada", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const otherUserId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const otherInput = await buildCreateOrderInput(otherUserId, lines);
    const input = await buildCreateOrderInput(userId, lines, {
      quoteId: otherInput.quoteId,
      rateId: otherInput.rateId,
    });

    await expect(createOrder(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(await Order.countDocuments({ userId })).toBe(0);
  });

  it("un carrito que cambió desde que se cotizó el envío se rechaza (fingerprint distinto)", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines);
    input.lines = [{ itemType: "product", itemId: variantId.toString(), quantity: 3 }];

    await expect(createOrder(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(await Order.countDocuments({ userId })).toBe(0);
  });
});
