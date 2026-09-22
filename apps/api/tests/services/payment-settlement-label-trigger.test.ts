import { OrderStatus, PaymentMethod, ShippingLabelStatus } from "@esencia-glow/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { __flushLabelTriggersForTests, __setLabelTriggerEnabledForTests } from "../../src/services/order-label-trigger.js";
import { createOrder } from "../../src/services/order.service.js";
import { settleCapturedPayment } from "../../src/services/payment-settlement.service.js";
import { __setShippingProviderForTests } from "../../src/services/shipping-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";
import { buildFakeShippingProvider } from "../helpers/fake-shipping-provider.js";
import { seedShippingOrigin } from "../helpers/paid-order-fixtures.js";
import { releaseReservationDetailed } from "../../src/services/stock-reservation.service.js";

/**
 * La guía se dispara tras el commit del pago (1.9): SOLO cuando `settleCapturedPayment`
 * realmente pagó la orden — nunca en un replay del webhook ni en una anomalía —
 * y un fallo del proveedor jamás rompe el cierre del pago (Stripe reintentaría
 * el evento para siempre).
 */
describe("services/payment-settlement — disparo de la guía", () => {
  beforeEach(async () => {
    resetCheckoutFixtureCounter();
    __setLabelTriggerEnabledForTests(true);
    await seedShippingOrigin();
  });

  afterEach(async () => {
    await __flushLabelTriggersForTests();
    __setLabelTriggerEnabledForTests(false);
  });

  async function createPendingOrder() {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const { order } = await createOrder(await buildCreateOrderInput(randomUserId(), lines, { paymentMethod: PaymentMethod.CARD }));
    return order;
  }

  const captured = (order: { totalCents: number; currency: string }, intentId = "pi_lbl") => ({
    intentId,
    status: "captured" as const,
    amountCents: order.totalCents,
    currency: order.currency,
  });

  it("un pago confirmado (outcome paid) compra la guía y deja la orden en processing", async () => {
    const order = await createPendingOrder();
    const provider = buildFakeShippingProvider();
    __setShippingProviderForTests(provider);

    const result = await settleCapturedPayment(order._id.toString(), captured(order));
    await __flushLabelTriggersForTests();

    expect(result.outcome).toBe("paid");
    expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
    const after = await Order.findById(order._id).lean();
    expect(after!.label!.status).toBe(ShippingLabelStatus.READY);
    expect(after!.status).toBe(OrderStatus.PROCESSING);
  });

  it("un replay del webhook (already_paid) NO vuelve a comprar", async () => {
    const order = await createPendingOrder();
    const provider = buildFakeShippingProvider();
    __setShippingProviderForTests(provider);

    await settleCapturedPayment(order._id.toString(), captured(order));
    await __flushLabelTriggersForTests();
    const replay = await settleCapturedPayment(order._id.toString(), captured(order));
    await __flushLabelTriggersForTests();

    expect(replay.outcome).toBe("already_paid");
    expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
  });

  it("un monto que no coincide (amount_mismatch) NO compra guía", async () => {
    const order = await createPendingOrder();
    const provider = buildFakeShippingProvider();
    __setShippingProviderForTests(provider);

    const result = await settleCapturedPayment(order._id.toString(), { ...captured(order), amountCents: order.totalCents + 100 });
    await __flushLabelTriggersForTests();

    expect(result.outcome).toBe("amount_mismatch");
    expect(provider.purchaseLabel).not.toHaveBeenCalled();
  });

  it("un inventory_incident NO compra guía (queda para revisión humana)", async () => {
    const order = await createPendingOrder();
    await releaseReservationDetailed(order.reservationId.toString());
    const provider = buildFakeShippingProvider();
    __setShippingProviderForTests(provider);

    const result = await settleCapturedPayment(order._id.toString(), captured(order));
    await __flushLabelTriggersForTests();

    expect(result.outcome).toBe("inventory_incident");
    expect(provider.purchaseLabel).not.toHaveBeenCalled();
  });

  it("si el proveedor revienta, el cierre del pago NO falla (la orden queda paid y la guía en revisión)", async () => {
    const order = await createPendingOrder();
    __setShippingProviderForTests(buildFakeShippingProvider({ purchaseLabel: vi.fn().mockRejectedValue(new TypeError("boom")) }));

    const result = await settleCapturedPayment(order._id.toString(), captured(order));
    await __flushLabelTriggersForTests();

    expect(result.outcome).toBe("paid");
    const after = await Order.findById(order._id).lean();
    expect(after!.status).toBe(OrderStatus.PAID);
    expect(after!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
  });

  it("sin proveedor configurado el pago cierra igual y la guía queda pending para el job", async () => {
    const order = await createPendingOrder();
    __setShippingProviderForTests(undefined);

    const result = await settleCapturedPayment(order._id.toString(), captured(order));
    await __flushLabelTriggersForTests();

    expect(result.outcome).toBe("paid");
    const after = await Order.findById(order._id).lean();
    expect(after!.label!.status).toBe(ShippingLabelStatus.PENDING);
    expect(after!.label!.attempts).toBe(0);
  });
});
