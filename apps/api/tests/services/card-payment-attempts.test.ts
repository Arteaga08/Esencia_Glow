import { MAX_CARD_FAILED_ATTEMPTS, OrderStatus, PaymentMethod, PaymentState } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { recordCardPaymentFailure } from "../../src/services/card-payment-attempts.service.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `card-payment-attempts.service.ts` — tope anti card-testing (decisión 10
 * del plan de 1.6, §8 del plan de 1.6.2). Se prueba directo sobre el
 * servicio (sin pasar por el webhook/dedupe) para aislar su propia
 * idempotencia (`payment.failedEventIds`, decisión 5).
 */
describe("services/card-payment-attempts — recordCardPaymentFailure", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createPendingOrder(method: PaymentMethod) {
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
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: method });
    const { order } = await createOrder(input);
    const provider = buildFakePaymentProvider();
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    return { order, userId, variantId, provider };
  }

  it("4 rechazos distintos -> sigue pending con failedAttempts: 4, state failed y lastError", async () => {
    const { order, provider } = await createPendingOrder(PaymentMethod.CARD);

    for (let i = 0; i < 4; i += 1) {
      await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: `evt_${i}`, lastError: "Tarjeta rechazada", provider });
    }

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
    expect(reloaded?.payment.failedAttempts).toBe(4);
    expect(reloaded?.payment.state).toBe(PaymentState.FAILED);
    expect(reloaded?.payment.lastError).toBe("Tarjeta rechazada");
    expect(provider.cancel).not.toHaveBeenCalled();
  });

  it("el 5.º rechazo cierra el pedido: cancela el PI y libera el stock", async () => {
    const { order, provider, variantId } = await createPendingOrder(PaymentMethod.CARD);

    for (let i = 0; i < MAX_CARD_FAILED_ATTEMPTS; i += 1) {
      await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: `evt_${i}`, provider });
    }

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.status).toBe(OrderStatus.CANCELLED);
    expect(reloaded?.payment.failedAttempts).toBe(MAX_CARD_FAILED_ATTEMPTS);
    expect(provider.cancel).toHaveBeenCalledWith(reloaded?.payment.intentId, `order:${order._id.toString()}:cancel`);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("el mismo eventId reprocesado (sin dedupe de por medio) no cuenta dos veces", async () => {
    const { order, provider } = await createPendingOrder(PaymentMethod.CARD);

    await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: "evt_repetido", provider });
    await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: "evt_repetido", provider });
    await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: "evt_repetido", provider });

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.payment.failedAttempts).toBe(1);
  });

  it("rechazo sobre un pedido OXXO no cuenta (failedAttempts intacto)", async () => {
    const { order, provider } = await createPendingOrder(PaymentMethod.OXXO);

    await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: "evt_oxxo", provider });

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.payment.failedAttempts).toBe(0);
    expect(provider.cancel).not.toHaveBeenCalled();
  });

  it("🔀 5 eventos distintos concurrentes -> exactamente un cierre y failedAttempts: 5", async () => {
    const { order, provider, variantId } = await createPendingOrder(PaymentMethod.CARD);

    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        recordCardPaymentFailure({ orderId: order._id.toString(), eventId: `evt_race_${i}`, provider }),
      ),
    );

    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.status).toBe(OrderStatus.CANCELLED);
    expect(reloaded?.payment.failedAttempts).toBe(5);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });
});
