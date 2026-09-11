import { PaymentMethod } from "@esencia-glow/shared";
import { OrderStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { reconcilePendingPayments } from "../../src/jobs/reconcile-pending-payments.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { User } from "../../src/models/user.model.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

/**
 * `reconcilePendingPayments` — respaldo para webhooks perdidos (§D del plan
 * de 1.6): pedidos `pending` con PaymentIntent, viejos ya un rato, se
 * consultan directo a Stripe. Si Stripe dice que capturó, se liquida sin
 * esperar el webhook.
 */
describe("jobs/reconcilePendingPayments", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createPendingOrderWithIntent(provider = buildFakePaymentProvider()) {
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
    const input = await buildCreateOrderInput(userId, [
      { itemType: "product", itemId: variantId.toString(), quantity: 1 },
    ], { paymentMethod: PaymentMethod.CARD });
    const { order } = await createOrder(input);
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    // Simula que el pedido lleva un rato esperando (más allá del umbral).
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - 60 * 60_000) } });
    return { order, variantId, provider };
  }

  it("Stripe confirma captured: liquida a paid sin esperar el webhook", async () => {
    const { order, variantId, provider } = await createPendingOrderWithIntent();
    provider.getAuthorization = vi.fn().mockResolvedValue({
      intentId: "pi_reconciled",
      status: "captured",
      amountCents: order.totalCents,
      currency: order.currency,
    });

    const summary = await reconcilePendingPayments(new Date(), 100, provider, 10);

    expect(summary.reconciled).toBe(1);
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PAID);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(9);
  });

  it("Stripe sigue sin resolver: no toca la orden, pero sella lastCheckedAt (backoff)", async () => {
    const provider = buildFakePaymentProvider({
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_pending",
        status: "awaiting_customer",
        amountCents: 50000,
        currency: "MXN",
      }),
    });
    const { order } = await createPendingOrderWithIntent(provider);

    const summary = await reconcilePendingPayments(new Date(), 100, provider, 10);

    expect(summary.reconciled).toBe(0);
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
    expect(reloaded?.payment.lastCheckedAt).toBeInstanceOf(Date);
  });

  it("un pedido reciente (dentro del umbral) NO se reconcilia todavía", async () => {
    const provider = buildFakePaymentProvider();
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
    const input = await buildCreateOrderInput(userId, [
      { itemType: "product", itemId: variantId.toString(), quantity: 1 },
    ]);
    const { order } = await createOrder(input);
    await ensurePaymentIntent(order._id.toString(), userId, { provider });

    const summary = await reconcilePendingPayments(new Date(), 100, provider, 10);

    expect(summary.scanned).toBe(0);
    expect(provider.getAuthorization).not.toHaveBeenCalled();
  });
});
