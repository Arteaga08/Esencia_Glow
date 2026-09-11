import { InventoryAction, OrderAction, OrderStatus, PaymentState } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { cancelMyOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { releaseReservationDetailed } from "../../src/services/stock-reservation.service.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

/**
 * `markOrderPaid` — gancho de 1.6, ver plan §E. El caso que más importa:
 * la reserva ya liberada NUNCA debe fingir un commit exitoso ni dejar la
 * orden en `pending` (el webhook reintentaría para siempre) — se marca
 * `paid` (el dinero es real) + `inventoryIncident`, para revisión humana.
 */

describe("services/order-payment — markOrderPaid", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createPendingOrder(onHand = 10) {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines);
    const { order } = await createOrder(input);
    return { order, variantId };
  }

  it("commit real: transiciona a paid, comete la reserva (onHand baja, reserved baja) y audita ORDER_PAID", async () => {
    const { order, variantId } = await createPendingOrder(10);

    const result = await markOrderPaid({ orderId: order._id.toString() });

    expect(result.outcome).toBe("paid");
    expect(result.order.status).toBe(OrderStatus.PAID);
    expect(result.order.payment.state).toBe(PaymentState.SUCCEEDED);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(8);
    expect(inventory?.reserved).toBe(0);

    const auditCount = await AuditLog.countDocuments({ action: OrderAction.ORDER_PAID, targetId: order._id });
    expect(auditCount).toBe(1);

    const reservationAudit = await AuditLog.countDocuments({
      action: InventoryAction.RESERVATION_COMMITTED,
      targetId: order.reservationId,
    });
    expect(reservationAudit).toBe(1);
  });

  it("una segunda llamada (reintento de webhook) es idempotente: outcome already_paid, sin duplicar el commit ni el audit", async () => {
    const { order } = await createPendingOrder(10);

    await markOrderPaid({ orderId: order._id.toString() });
    const second = await markOrderPaid({ orderId: order._id.toString() });

    expect(second.outcome).toBe("already_paid");
    expect(second.order.status).toBe(OrderStatus.PAID);

    const auditCount = await AuditLog.countDocuments({ action: OrderAction.ORDER_PAID, targetId: order._id });
    expect(auditCount).toBe(1);
  });

  it("reserva ya liberada: la orden queda paid + inventoryIncident, nunca pending ni un commit fingido", async () => {
    const { order } = await createPendingOrder(10);
    await releaseReservationDetailed(order.reservationId.toString());

    const result = await markOrderPaid({ orderId: order._id.toString() });

    expect(result.outcome).toBe("inventory_incident");
    expect(result.order.status).toBe(OrderStatus.PAID);
    expect(result.order.inventoryIncident).toBe(true);
    expect(result.order.adminAlertedAt).toBeInstanceOf(Date);

    const incidentAudit = await AuditLog.countDocuments({
      action: OrderAction.ORDER_STOCK_INCIDENT,
      targetId: order._id,
    });
    expect(incidentAudit).toBe(1);
  });

  it("una orden cancelada no puede marcarse como pagada", async () => {
    const { order } = await createPendingOrder(10);
    await cancelMyOrder(order._id.toString(), order.userId.toString());

    await expect(markOrderPaid({ orderId: order._id.toString() })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("un orderId inexistente responde 404", async () => {
    const fakeId = "aaaaaaaaaaaaaaaaaaaaaaaa";
    await expect(markOrderPaid({ orderId: fakeId })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("🔀 markOrderPaid y una cancelación compiten por la misma orden: nunca paid con la reserva liberada sin marcar el incidente, nunca cancelled con stock ya descontado", async () => {
    const { order, variantId } = await createPendingOrder(10);

    const results = await Promise.allSettled([
      markOrderPaid({ orderId: order._id.toString() }),
      cancelMyOrder(order._id.toString(), order.userId.toString()),
    ]);

    const reloaded = await Order.findById(order._id);
    const inventory = await Inventory.findOne({ variantId });

    if (reloaded!.status === OrderStatus.PAID) {
      // Ganó el pago: si la cancelación alcanzó a liberar la reserva antes,
      // el incidente debe estar marcado — nunca un commit fingido.
      if (inventory!.onHand === 10) {
        expect(reloaded!.inventoryIncident).toBe(true);
      } else {
        expect(inventory!.onHand).toBe(8);
        expect(inventory!.reserved).toBe(0);
      }
    } else {
      // Ganó la cancelación: el stock nunca se descontó de onHand.
      expect(reloaded!.status).toBe(OrderStatus.CANCELLED);
      expect(inventory!.onHand).toBe(10);
      expect(inventory!.reserved).toBe(0);
    }

    // Pase lo que pase, alguna de las dos operaciones debe haber resuelto (ninguna cuelga sin resultado).
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
  });
});
