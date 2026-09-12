import { authenticator } from "otplib";
import { OrderStatus, PaymentMethod } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { Order } from "../../src/models/order.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { __setPaymentProviderForTests } from "../../src/services/payment-provider.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { createAdminSession, createCustomerSession, enableAdminTwoFactor } from "../helpers/admin-session.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `POST /api/v1/admin/orders/:id/refund` — §5 del plan de 1.6.3. Step-up
 * 2FA obligatorio ANTES de tocar Stripe (decisión 9 del plan de 1.6):
 * ningún caso de error de esta suite deja registrada una llamada a
 * `provider.refund`.
 */
const app = buildApp();

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
  const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
  const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }], {
    paymentMethod: PaymentMethod.CARD,
  });
  const { order } = await createOrder(input);
  const provider = buildFakePaymentProvider();
  await ensurePaymentIntent(order._id.toString(), userId, { provider });
  await markOrderPaid({ orderId: order._id.toString() });
  return order;
}

describe("routes/admin-order — POST /:id/refund", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("una cookie de customer responde 403", async () => {
    const order = await seedPaidOrder();
    const { agent } = await createCustomerSession(app);

    const res = await agent.post(`/api/v1/admin/orders/${order._id}/refund`).send({ twoFactorCode: "123456" });

    expect(res.status).toBe(403);
  });

  it("sin twoFactorCode -> 400", async () => {
    const order = await seedPaidOrder();
    const { agent } = await createAdminSession(app);

    const res = await agent.post(`/api/v1/admin/orders/${order._id}/refund`).send({});

    expect(res.status).toBe(400);
  });

  it("admin sin 2FA activo -> 403, sin llamar a refund", async () => {
    const order = await seedPaidOrder();
    const { agent } = await createAdminSession(app);
    const fake = buildFakePaymentProvider();
    __setPaymentProviderForTests(fake);

    const res = await agent.post(`/api/v1/admin/orders/${order._id}/refund`).send({ twoFactorCode: "123456" });

    expect(res.status).toBe(403);
    expect(fake.refund).not.toHaveBeenCalled();
  });

  it("código 2FA inválido -> 401, sin llamar a refund", async () => {
    const order = await seedPaidOrder();
    const { agent, adminId } = await createAdminSession(app);
    await enableAdminTwoFactor(adminId);
    const fake = buildFakePaymentProvider();
    __setPaymentProviderForTests(fake);

    const res = await agent.post(`/api/v1/admin/orders/${order._id}/refund`).send({ twoFactorCode: "000000" });

    expect(res.status).toBe(401);
    expect(fake.refund).not.toHaveBeenCalled();
  });

  it("pedido pending -> 409", async () => {
    const userId = randomUserId();
    await User.create({ _id: userId, email: `${userId}@example.com`, password: "P4ssword!!", firstName: "A", lastName: "B", emailVerified: true });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }]);
    const { order: pendingOrder } = await createOrder(input);
    const { agent, adminId } = await createAdminSession(app);
    const secret = await enableAdminTwoFactor(adminId);

    const res = await agent
      .post(`/api/v1/admin/orders/${pendingOrder._id}/refund`)
      .send({ twoFactorCode: authenticator.generate(secret) });

    expect(res.status).toBe(409);
  });

  it("pago OXXO -> 409", async () => {
    const userId = randomUserId();
    await User.create({ _id: userId, email: `${userId}@example.com`, password: "P4ssword!!", firstName: "A", lastName: "B", emailVerified: true });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }], {
      paymentMethod: PaymentMethod.OXXO,
    });
    const { order: created } = await createOrder(input);
    await Order.updateOne(
      { _id: created._id },
      { $set: { status: OrderStatus.PAID, "payment.state": "captured", "payment.intentId": "pi_oxxo_route" } },
    );
    const { agent, adminId } = await createAdminSession(app);
    const secret = await enableAdminTwoFactor(adminId);

    const res = await agent.post(`/api/v1/admin/orders/${created._id}/refund`).send({ twoFactorCode: authenticator.generate(secret) });

    expect(res.status).toBe(409);
  });

  it("código válido -> 202 + refundRequestedAt sellado, refund llamado por el remanente", async () => {
    const order = await seedPaidOrder();
    const { agent, adminId } = await createAdminSession(app);
    const secret = await enableAdminTwoFactor(adminId);
    const fake = buildFakePaymentProvider();
    __setPaymentProviderForTests(fake);

    const res = await agent
      .post(`/api/v1/admin/orders/${order._id}/refund`)
      .send({ twoFactorCode: authenticator.generate(secret), reason: "Cliente se arrepintió" });

    expect(res.status).toBe(202);
    expect(fake.refund).toHaveBeenCalledTimes(1);
    const [refundInput] = vi.mocked(fake.refund).mock.calls[0]!;
    expect(refundInput.amountCents).toBe(order.totalCents);

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded!.payment.refundRequestedAt).toBeInstanceOf(Date);
  });
});
