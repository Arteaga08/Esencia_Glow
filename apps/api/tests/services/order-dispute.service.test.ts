import { DisputeStatus, OrderStatus, PaymentMethod, ShippingCarrier } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Order } from "../../src/models/order.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { changeOrderStatus } from "../../src/services/order-admin-status.service.js";
import { openDispute, closeDispute } from "../../src/services/order-dispute.service.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `order-dispute.service` — traduce `charge.dispute.*` a `disputeStatus`
 * (§6 del plan de 1.6.3). Un contracargo perdido NUNCA es `refunded`: el
 * dinero se fue por la vía de la disputa, no por un reembolso nuestro. El
 * guard bloquea despachar mercancía bajo contracargo abierto
 * (BACKEND_SECURITY_GUIDELINES.md §"guards de estado terminal").
 */
describe("services/order-dispute", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function seedPaidOrder() {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const adminId = randomUserId();
    await User.create({
      _id: adminId,
      email: `${adminId}@example.com`,
      password: "P4ssword!!",
      firstName: "Admin",
      lastName: "Glow",
      role: "admin",
      emailVerified: true,
    });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }], {
      paymentMethod: PaymentMethod.CARD,
    });
    const { order: created } = await createOrder(input);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(created._id.toString(), userId, { provider });
    await markOrderPaid({ orderId: created._id.toString() });
    return { orderId: created._id.toString(), adminId };
  }

  it("openDispute: pone disputeStatus:open y sella disputedAt", async () => {
    const { orderId } = await seedPaidOrder();

    await openDispute(orderId);

    const order = await Order.findById(orderId).lean();
    expect(order!.disputeStatus).toBe(DisputeStatus.OPEN);
    expect(order!.disputedAt).toBeInstanceOf(Date);
    const audits = await AuditLog.countDocuments({ action: "order_disputed", targetId: orderId });
    expect(audits).toBe(1);
  });

  it("openDispute es idempotente: una segunda llamada no duplica el audit", async () => {
    const { orderId } = await seedPaidOrder();
    await openDispute(orderId);

    await openDispute(orderId);

    const audits = await AuditLog.countDocuments({ action: "order_disputed", targetId: orderId });
    expect(audits).toBe(1);
  });

  it("closeDispute(lost): status de la orden intacto, NUNCA refunded", async () => {
    const { orderId } = await seedPaidOrder();
    await openDispute(orderId);

    await closeDispute(orderId, DisputeStatus.LOST);

    const order = await Order.findById(orderId).lean();
    expect(order!.disputeStatus).toBe(DisputeStatus.LOST);
    expect(order!.status).toBe(OrderStatus.PAID);
    const audits = await AuditLog.countDocuments({ action: "order_dispute_closed", targetId: orderId });
    expect(audits).toBe(1);
  });

  it("dispute.closed antes que dispute.opened (fuera de orden): closed no se reabre después", async () => {
    const { orderId } = await seedPaidOrder();

    await closeDispute(orderId, DisputeStatus.WON);
    await openDispute(orderId); // llega tarde, fuera de orden

    const order = await Order.findById(orderId).lean();
    expect(order!.disputeStatus).toBe(DisputeStatus.WON);
  });

  it("disputa abierta bloquea paid -> processing con 409", async () => {
    const { orderId, adminId } = await seedPaidOrder();
    await openDispute(orderId);

    await expect(
      changeOrderStatus({ orderId, targetStatus: OrderStatus.PROCESSING, adminId }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe(OrderStatus.PAID);
  });

  it("disputa abierta bloquea processing -> shipped con 409", async () => {
    const { orderId, adminId } = await seedPaidOrder();
    await changeOrderStatus({ orderId, targetStatus: OrderStatus.PROCESSING, adminId });
    await openDispute(orderId);

    await expect(
      changeOrderStatus({
        orderId,
        targetStatus: OrderStatus.SHIPPED,
        adminId,
        shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "TRACK1" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("disputa ganada (won) desbloquea la transición", async () => {
    const { orderId, adminId } = await seedPaidOrder();
    await openDispute(orderId);
    await closeDispute(orderId, DisputeStatus.WON);

    await expect(changeOrderStatus({ orderId, targetStatus: OrderStatus.PROCESSING, adminId })).resolves.toBeDefined();

    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe(OrderStatus.PROCESSING);
  });
});
