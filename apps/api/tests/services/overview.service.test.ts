import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { OrderStatus, OverviewRange, PaymentMethod, PaymentState } from "@esencia-glow/shared";
import { Order } from "../../src/models/order.model.js";
import { SubscriptionInvoice } from "../../src/models/subscription-invoice.model.js";
import { resolveOverviewWindow } from "../../src/utils/resolve-overview-window.js";
import { getSalesSeries } from "../../src/services/overview.service.js";

/**
 * `overview.service.ts` (Milestone 2.9) — serie de ventas del Resumen del
 * panel. Ingreso tienda = pedidos comprados de verdad (mismo criterio que
 * `PURCHASED_ORDER_STATUSES`), fechado por `payment.capturedAt`, neto de
 * reembolso parcial. Ingreso suscripciones = suma de `SubscriptionInvoice`,
 * fechado por `paidAt`. Series SEPARADAS, nunca sumadas en un solo total.
 */

function buildOrderAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  const userId = new mongoose.Types.ObjectId();
  return {
    orderNumber: `EG-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`,
    userId,
    status: OrderStatus.PAID,
    lines: [
      {
        itemType: "product",
        itemId: new mongoose.Types.ObjectId(),
        sku: "SER-30",
        name: "Sérum Vitamina C",
        variantName: "30ml",
        unitPriceCents: 50000,
        quantity: 1,
        lineTotalCents: 50000,
      },
    ],
    subtotalCents: 50000,
    discountCents: 0,
    taxCents: 6897,
    taxRateBps: 1600,
    shippingCents: 12000,
    totalCents: 68897,
    currency: "MXN",
    payment: {
      provider: "stripe",
      method: PaymentMethod.CARD,
      state: PaymentState.CAPTURED,
      captureMethod: "automatic",
      failedAttempts: 0,
      capturedAt: new Date(),
    },
    shippingAddress: {
      fullName: "Ana Pérez",
      phone: "5512345678",
      street: "Av. Reforma",
      exteriorNumber: "100",
      neighborhood: "Juárez",
      city: "CDMX",
      state: "Ciudad de México",
      postalCode: "06600",
    },
    shippingSelection: { rateId: "rate-1", carrier: "estafeta", service: "standard", amountCents: 12000, estimatedDays: 3 },
    parcel: { weightGrams: 350, lengthCm: 15, widthCm: 15, heightCm: 11, volumetricWeightGrams: 1000 },
    termsAcceptedAt: new Date(),
    reservationId: new mongoose.Types.ObjectId(),
    statusHistory: [{ status: OrderStatus.PAID, at: new Date(), actorType: "user" }],
    inventoryIncident: false,
    ...overrides,
  };
}

async function seedInvoice(overrides: Partial<Record<string, unknown>> = {}) {
  return SubscriptionInvoice.create({
    invoiceRef: `in_${new mongoose.Types.ObjectId().toString()}`,
    accountId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    planId: new mongoose.Types.ObjectId(),
    amountPaidCents: 59900,
    currency: "mxn",
    paidAt: new Date(),
    ...overrides,
  });
}

const NOW = new Date("2026-09-30T20:00:00Z"); // Miércoles 30 sep, 14:00 local.

describe("services/overview — getSalesSeries", () => {
  it("suma un pedido pagado en la cubeta de su payment.capturedAt, neto de reembolso parcial", async () => {
    const window = resolveOverviewWindow(OverviewRange.WEEK, NOW);
    const bucketDate = window.bucketStarts[6]!; // hoy

    await Order.create(
      buildOrderAttrs({
        totalCents: 68897,
        payment: {
          provider: "stripe",
          method: PaymentMethod.CARD,
          state: PaymentState.CAPTURED,
          captureMethod: "automatic",
          failedAttempts: 0,
          capturedAt: bucketDate,
          refundedAmountCents: 10000,
        },
      }),
    );

    const series = await getSalesSeries(OverviewRange.WEEK, NOW);

    const bucket = series.buckets[6]!;
    expect(bucket.storeRevenueCents).toBe(68897 - 10000);
    expect(bucket.orderCount).toBe(1);
  });

  it("excluye pedidos pending, cancelled y refunded del ingreso de la tienda", async () => {
    const window = resolveOverviewWindow(OverviewRange.WEEK, NOW);
    const bucketDate = window.bucketStarts[6]!;

    await Order.create(buildOrderAttrs({ status: OrderStatus.PENDING, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.PENDING, captureMethod: "automatic", failedAttempts: 0, capturedAt: bucketDate } }));
    await Order.create(buildOrderAttrs({ status: OrderStatus.CANCELLED, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", failedAttempts: 0, capturedAt: bucketDate } }));
    await Order.create(buildOrderAttrs({ status: OrderStatus.REFUNDED, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.REFUNDED, captureMethod: "automatic", failedAttempts: 0, capturedAt: bucketDate } }));

    const series = await getSalesSeries(OverviewRange.WEEK, NOW);

    expect(series.totals.storeRevenueCents).toBe(0);
    expect(series.totals.orderCount).toBe(0);
  });

  it("suma facturas de suscripción por separado, fechadas por paidAt", async () => {
    const window = resolveOverviewWindow(OverviewRange.WEEK, NOW);
    const bucketDate = window.bucketStarts[5]!; // ayer

    await seedInvoice({ amountPaidCents: 59900, paidAt: bucketDate });
    await seedInvoice({ amountPaidCents: 89900, paidAt: bucketDate });

    const series = await getSalesSeries(OverviewRange.WEEK, NOW);

    expect(series.buckets[5]?.subscriptionRevenueCents).toBe(59900 + 89900);
    expect(series.buckets[5]?.storeRevenueCents).toBe(0);
  });

  it("cubetas sin datos quedan en 0, nunca undefined", async () => {
    const series = await getSalesSeries(OverviewRange.WEEK, NOW);

    expect(series.buckets).toHaveLength(7);
    for (const bucket of series.buckets) {
      expect(bucket.storeRevenueCents).toBe(0);
      expect(bucket.orderCount).toBe(0);
      expect(bucket.subscriptionRevenueCents).toBe(0);
    }
  });

  it("totals es la suma de todas las cubetas de la ventana actual", async () => {
    const window = resolveOverviewWindow(OverviewRange.WEEK, NOW);

    await Order.create(buildOrderAttrs({ totalCents: 10000, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", failedAttempts: 0, capturedAt: window.bucketStarts[0] } }));
    await Order.create(buildOrderAttrs({ totalCents: 20000, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", failedAttempts: 0, capturedAt: window.bucketStarts[6] } }));

    const series = await getSalesSeries(OverviewRange.WEEK, NOW);

    expect(series.totals.storeRevenueCents).toBe(30000);
    expect(series.totals.orderCount).toBe(2);
  });

  it("previousTotals suma solo la ventana ANTERIOR, sin mezclarse con la actual", async () => {
    const window = resolveOverviewWindow(OverviewRange.WEEK, NOW);
    const dayBeforeWindow = new Date(window.previousWindowStart.getTime() + 24 * 60 * 60 * 1000);

    // Dentro de la ventana anterior.
    await Order.create(buildOrderAttrs({ totalCents: 15000, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", failedAttempts: 0, capturedAt: dayBeforeWindow } }));
    // Dentro de la ventana actual.
    await Order.create(buildOrderAttrs({ totalCents: 40000, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", failedAttempts: 0, capturedAt: window.bucketStarts[0] } }));

    const series = await getSalesSeries(OverviewRange.WEEK, NOW);

    expect(series.previousTotals.storeRevenueCents).toBe(15000);
    expect(series.totals.storeRevenueCents).toBe(40000);
  });

  it("un pedido justo ANTES de windowStart queda fuera de la ventana actual", async () => {
    const window = resolveOverviewWindow(OverviewRange.WEEK, NOW);
    const justBefore = new Date(window.windowStart.getTime() - 1000);

    await Order.create(buildOrderAttrs({ totalCents: 99999, payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", failedAttempts: 0, capturedAt: justBefore } }));

    const series = await getSalesSeries(OverviewRange.WEEK, NOW);

    expect(series.totals.storeRevenueCents).toBe(0);
  });
});
