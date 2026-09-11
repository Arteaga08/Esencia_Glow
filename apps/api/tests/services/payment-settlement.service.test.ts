import { OrderStatus, PaymentMethod, PaymentState } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { settleCapturedPayment } from "../../src/services/payment-settlement.service.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

/**
 * `settleCapturedPayment` — el único camino que transiciona una orden a
 * `paid` cuando Stripe confirma el cobro (usado por el webhook en 1.6.2 y
 * por el reconciliador aquí en 1.6.1). Verifica monto/moneda ANTES de
 * confiar en el pago: un desajuste nunca transiciona, se audita como
 * anomalía para revisión humana.
 */
describe("services/payment-settlement — settleCapturedPayment", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createPendingOrder() {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod: PaymentMethod.CARD });
    const { order } = await createOrder(input);
    return { order, variantId };
  }

  it("monto y moneda coinciden: transiciona a paid con card capturado", async () => {
    const { order, variantId } = await createPendingOrder();

    const result = await settleCapturedPayment(order._id.toString(), {
      intentId: "pi_1",
      status: "captured",
      amountCents: order.totalCents,
      currency: order.currency,
      card: { brand: "visa", last4: "4242" },
    });

    expect(result.outcome).toBe("paid");
    const reloaded = await Order.findById(order._id).lean();
    expect(reloaded?.status).toBe(OrderStatus.PAID);
    expect(reloaded?.payment.state).toBe(PaymentState.CAPTURED);
    expect(reloaded?.payment.card).toEqual({ brand: "visa", last4: "4242" });

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.onHand).toBe(8);
  });

  it("monto distinto: NO transiciona, se marca anomalía", async () => {
    const { order } = await createPendingOrder();

    const result = await settleCapturedPayment(order._id.toString(), {
      intentId: "pi_2",
      status: "captured",
      amountCents: order.totalCents + 100,
      currency: order.currency,
    });

    expect(result.outcome).toBe("amount_mismatch");
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.PENDING);
    expect(reloaded?.adminAlertedAt).toBeInstanceOf(Date);
  });

  it("orden ya cancelada (pago tardío): anomalía, sin transición", async () => {
    const { order } = await createPendingOrder();
    await Order.updateOne({ _id: order._id }, { $set: { status: OrderStatus.CANCELLED } });

    const result = await settleCapturedPayment(order._id.toString(), {
      intentId: "pi_3",
      status: "captured",
      amountCents: order.totalCents,
      currency: order.currency,
    });

    expect(result.outcome).toBe("late_payment");
    const reloaded = await Order.findById(order._id);
    expect(reloaded?.status).toBe(OrderStatus.CANCELLED);
    expect(reloaded?.adminAlertedAt).toBeInstanceOf(Date);
  });

  it("captura duplicada (ya paid): idempotente, already_paid", async () => {
    const { order } = await createPendingOrder();
    await settleCapturedPayment(order._id.toString(), {
      intentId: "pi_4",
      status: "captured",
      amountCents: order.totalCents,
      currency: order.currency,
    });

    const second = await settleCapturedPayment(order._id.toString(), {
      intentId: "pi_4",
      status: "captured",
      amountCents: order.totalCents,
      currency: order.currency,
    });

    expect(second.outcome).toBe("already_paid");
  });
});
