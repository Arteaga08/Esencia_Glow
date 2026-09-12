import { authenticator } from "otplib";
import { DisputeStatus, OrderStatus, PaymentMethod, ShippingCarrier } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Order } from "../../src/models/order.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { changeOrderStatus } from "../../src/services/order-admin-status.service.js";
import { requestOrderRefund } from "../../src/services/order-refund.service.js";
import { encryptSecret } from "../../src/utils/crypto.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `requestOrderRefund` — endpoint admin de reembolso (§5 del plan de
 * 1.6.3): step-up 2FA obligatorio ANTES de tocar Stripe (decisión 9 del
 * plan de 1.6), mutex con lease sobre `payment.refundRequestedAt`
 * (decisión 3 de 1.6.3) para que dos solicitudes concurrentes nunca
 * disparen dos reembolsos.
 */
describe("services/order-refund — requestOrderRefund", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createAdmin(opts: { twoFactorEnabled?: boolean } = {}) {
    const adminId = randomUserId();
    const secret = authenticator.generateSecret();
    await User.create({
      _id: adminId,
      email: `${adminId}@example.com`,
      password: "P4ssword!!",
      firstName: "Admin",
      lastName: "Glow",
      role: "admin",
      emailVerified: true,
      twoFactor: { enabled: opts.twoFactorEnabled ?? true, secret: encryptSecret(secret) },
    });
    return { adminId, secret };
  }

  async function seedOrderAtStatus(target: OrderStatus) {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const adminForTransitions = randomUserId();
    await User.create({
      _id: adminForTransitions,
      email: `${adminForTransitions}@example.com`,
      password: "P4ssword!!",
      firstName: "Admin",
      lastName: "T",
      role: "admin",
      emailVerified: true,
    });

    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: PaymentMethod.CARD });
    const { order: created } = await createOrder(input);

    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(created._id.toString(), userId, { provider });
    await markOrderPaid({ orderId: created._id.toString() });

    if (target === OrderStatus.PROCESSING || target === OrderStatus.SHIPPED) {
      await changeOrderStatus({ orderId: created._id.toString(), targetStatus: OrderStatus.PROCESSING, adminId: adminForTransitions });
    }
    if (target === OrderStatus.SHIPPED) {
      await changeOrderStatus({
        orderId: created._id.toString(),
        targetStatus: OrderStatus.SHIPPED,
        adminId: adminForTransitions,
        shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "TRACK1" },
      });
    }

    const order = await Order.findById(created._id);
    return order!;
  }

  it("admin sin 2FA activo -> 403, el fake no registra ninguna llamada a refund", async () => {
    const { adminId } = await createAdmin({ twoFactorEnabled: false });
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const provider = buildFakePaymentProvider();

    await expect(
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: "000000", provider }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it("código 2FA inválido -> 401, sin llamar a refund", async () => {
    const { adminId } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const provider = buildFakePaymentProvider();

    await expect(
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: "000000", provider }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it("pedido pending -> 409", async () => {
    const { adminId, secret } = await createAdmin();
    const userId = randomUserId();
    await User.create({ _id: userId, email: `${userId}@example.com`, password: "P4ssword!!", firstName: "A", lastName: "B", emailVerified: true });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }]);
    const { order: pendingOrder } = await createOrder(input);
    const provider = buildFakePaymentProvider();

    await expect(
      requestOrderRefund({
        orderId: pendingOrder._id.toString(),
        adminId,
        twoFactorCode: authenticator.generate(secret),
        provider,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it("pago OXXO -> 409", async () => {
    const { adminId, secret } = await createAdmin();
    const userId = randomUserId();
    await User.create({ _id: userId, email: `${userId}@example.com`, password: "P4ssword!!", firstName: "A", lastName: "B", emailVerified: true });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }], {
      paymentMethod: PaymentMethod.OXXO,
    });
    const { order: created } = await createOrder(input);
    // OXXO nunca pasa por `markOrderPaid` en este test (no se confirma el
    // pago); forzamos el estado + intentId a mano para aislar la regla bajo
    // prueba (el guard de método, no el flujo OXXO completo).
    await Order.updateOne(
      { _id: created._id },
      { $set: { status: OrderStatus.PAID, "payment.state": "captured", "payment.intentId": "pi_oxxo_1" } },
    );
    const order = await Order.findById(created._id);
    const provider = buildFakePaymentProvider();

    await expect(
      requestOrderRefund({ orderId: order!._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it("disputa abierta -> 409", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    await Order.updateOne({ _id: order._id }, { $set: { disputeStatus: DisputeStatus.OPEN, disputedAt: new Date() } });
    const provider = buildFakePaymentProvider();

    await expect(
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it("ya reembolsado por completo -> 409", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    await Order.updateOne({ _id: order._id }, { $set: { "payment.refundedAmountCents": order.totalCents } });
    const provider = buildFakePaymentProvider();

    await expect(
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it("código válido: llama a refund por el remanente, sella refundRequestedAt y audita", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const provider = buildFakePaymentProvider();

    await requestOrderRefund({
      orderId: order._id.toString(),
      adminId,
      twoFactorCode: authenticator.generate(secret),
      reason: "Producto defectuoso",
      provider,
    });

    expect(provider.refund).toHaveBeenCalledTimes(1);
    const [refundInput] = vi.mocked(provider.refund).mock.calls[0]!;
    expect(refundInput.intentId).toBe(order.payment.intentId);
    expect(refundInput.amountCents).toBe(order.totalCents);

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded!.payment.refundRequestedAt).toBeInstanceOf(Date);

    const audit = await AuditLog.findOne({ action: "order_refund_requested", targetId: order._id });
    expect(audit).not.toBeNull();
    expect(audit!.actorId?.toString()).toBe(adminId);
  });

  it("🔀 dos solicitudes concurrentes: solo una llama a refund, la otra 409", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const provider = buildFakePaymentProvider();
    const code = authenticator.generate(secret);

    const results = await Promise.allSettled([
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: code, provider }),
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: code, provider }),
    ]);

    expect(provider.refund).toHaveBeenCalledTimes(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
  });

  it("Stripe falla al reembolsar: desmarca refundRequestedAt y el reintento funciona", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const failingProvider = buildFakePaymentProvider({
      refund: vi.fn().mockRejectedValue(Object.assign(new Error("Stripe caído"), { statusCode: 502 })),
    });

    await expect(
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider: failingProvider }),
    ).rejects.toMatchObject({ statusCode: 502 });

    const afterFailure = await Order.findById(order._id).lean();
    expect(afterFailure!.payment.refundRequestedAt).toBeUndefined();

    const workingProvider = buildFakePaymentProvider();
    await requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider: workingProvider });
    expect(workingProvider.refund).toHaveBeenCalledTimes(1);
  });

  it("recomputa el remanente desde el documento reclamado, no desde la lectura previa (carrera con un reembolso parcial concurrente)", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const provider = buildFakePaymentProvider();

    const originalFindById = Order.findById.bind(Order);
    const spy = vi.spyOn(Order, "findById").mockImplementationOnce((id: string) => {
      const snapshot = originalFindById(id);
      // Simula un reembolso PARCIAL concurrente (p. ej. hecho desde el
      // Dashboard de Stripe) que aterriza justo después de esta lectura,
      // pero antes de que el claim de `requestOrderRefund` corra — `then`
      // encadena la escritura DESPUÉS de que la lectura original resuelva,
      // sin bloquear su propio valor de retorno (mismo snapshot, ya stale).
      return snapshot.then(async (doc) => {
        await Order.updateOne({ _id: id }, { $set: { "payment.refundedAmountCents": 40000 } });
        return doc;
      }) as unknown as ReturnType<typeof Order.findById>;
    });

    await requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider });
    spy.mockRestore();

    const [refundInput] = vi.mocked(provider.refund).mock.calls[0]!;
    expect(refundInput.amountCents).toBe(order.totalCents - 40000);
  });

  it("provider.refund resuelve con status:'failed' (rechazo síncrono, sin lanzar): desmarca refundRequestedAt y no audita la solicitud", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const failingProvider = buildFakePaymentProvider({
      refund: vi.fn().mockResolvedValue({ refundId: "re_rejected", status: "failed" }),
    });

    await expect(
      requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider: failingProvider }),
    ).rejects.toThrow();

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded!.payment.refundRequestedAt).toBeUndefined();
    const audit = await AuditLog.findOne({ action: "order_refund_requested", targetId: order._id });
    expect(audit).toBeNull();
  });

  it("lease vencido: una nueva solicitud puede reclamarlo con otra llave", async () => {
    const { adminId, secret } = await createAdmin();
    const order = await seedOrderAtStatus(OrderStatus.PROCESSING);
    const staleDate = new Date(Date.now() - 60 * 60_000); // hace 1h, > 30 min de lease
    await Order.updateOne({ _id: order._id }, { $set: { "payment.refundRequestedAt": staleDate } });
    const provider = buildFakePaymentProvider();

    await requestOrderRefund({ orderId: order._id.toString(), adminId, twoFactorCode: authenticator.generate(secret), provider });

    expect(provider.refund).toHaveBeenCalledTimes(1);
    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded!.payment.refundRequestedAt!.getTime()).toBeGreaterThan(staleDate.getTime());
  });
});
