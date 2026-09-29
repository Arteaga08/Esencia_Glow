import { OverviewRange } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { SubscriptionInvoice } from "../models/subscription-invoice.model.js";
import { resolveOverviewWindow } from "../utils/resolve-overview-window.js";
import { PURCHASED_ORDER_STATUSES } from "./customer-admin.service.js";

/**
 * Serie de ventas del Resumen del panel (Milestone 2.9). Dos ingresos
 * SEPARADOS, nunca sumados en un solo total (decisión de Manuel): tienda
 * (pedidos comprados de verdad, mismo `PURCHASED_ORDER_STATUSES` que
 * `customer-admin.service.ts`, neto de reembolso parcial, fechado por
 * `payment.capturedAt`) y suscripciones (`SubscriptionInvoice`, fechado por
 * `paidAt`). Sin backend nuevo de agregación de Mongo por cubeta: la
 * ventana tiene como mucho unas decenas de documentos por rango (panel
 * admin de una tienda pequeña), así que se leen los campos mínimos y se
 * agrupan en JS contra las fronteras de `resolveOverviewWindow` — evita
 * duplicar esa lógica de calendario (irregular en el rango "año") como
 * pipeline de Mongo.
 */

interface SalesBucket {
  start: string;
  storeRevenueCents: number;
  orderCount: number;
  subscriptionRevenueCents: number;
}

interface SalesTotals {
  storeRevenueCents: number;
  orderCount: number;
  subscriptionRevenueCents: number;
}

interface SalesSeries {
  range: OverviewRange;
  buckets: SalesBucket[];
  totals: SalesTotals;
  previousTotals: SalesTotals;
}

interface LeanOrderRow {
  totalCents: number;
  payment: { capturedAt?: Date; refundedAmountCents?: number };
}

interface LeanInvoiceRow {
  amountPaidCents: number;
  paidAt: Date;
}

function emptyTotals(): SalesTotals {
  return { storeRevenueCents: 0, orderCount: 0, subscriptionRevenueCents: 0 };
}

/** Índice de la cubeta a la que pertenece `date` — la última cuyo inicio es
 * `<= date`. `bucketStarts` es ascendente por construcción
 * (`resolveOverviewWindow`), así que basta recorrerla de atrás hacia
 * adelante. `-1` si `date` cae antes de la primera cubeta (fuera de la
 * ventana, el caller ya filtró por rango pero se deja como defensa). */
function bucketIndexFor(date: Date, bucketStarts: Date[]): number {
  for (let i = bucketStarts.length - 1; i >= 0; i -= 1) {
    if (bucketStarts[i]!.getTime() <= date.getTime()) return i;
  }
  return -1;
}

async function getSalesSeries(range: OverviewRange, now: Date = new Date()): Promise<SalesSeries> {
  const window = resolveOverviewWindow(range, now);

  const [orders, invoices, previousOrders, previousInvoices] = await Promise.all([
    Order.find({
      status: { $in: PURCHASED_ORDER_STATUSES },
      "payment.capturedAt": { $gte: window.windowStart, $lt: now },
    })
      .select("totalCents payment.capturedAt payment.refundedAmountCents")
      .lean<LeanOrderRow[]>(),
    SubscriptionInvoice.find({ paidAt: { $gte: window.windowStart, $lt: now } })
      .select("amountPaidCents paidAt")
      .lean<LeanInvoiceRow[]>(),
    Order.find({
      status: { $in: PURCHASED_ORDER_STATUSES },
      "payment.capturedAt": { $gte: window.previousWindowStart, $lt: window.previousWindowEnd },
    })
      .select("totalCents payment.refundedAmountCents")
      .lean<LeanOrderRow[]>(),
    SubscriptionInvoice.find({ paidAt: { $gte: window.previousWindowStart, $lt: window.previousWindowEnd } })
      .select("amountPaidCents")
      .lean<LeanInvoiceRow[]>(),
  ]);

  const buckets: SalesBucket[] = window.bucketStarts.map((start) => ({
    start: start.toISOString(),
    storeRevenueCents: 0,
    orderCount: 0,
    subscriptionRevenueCents: 0,
  }));
  const totals = emptyTotals();

  for (const order of orders) {
    if (!order.payment.capturedAt) continue;
    const index = bucketIndexFor(order.payment.capturedAt, window.bucketStarts);
    if (index === -1) continue;
    const netCents = order.totalCents - (order.payment.refundedAmountCents ?? 0);
    buckets[index]!.storeRevenueCents += netCents;
    buckets[index]!.orderCount += 1;
    totals.storeRevenueCents += netCents;
    totals.orderCount += 1;
  }

  for (const invoice of invoices) {
    const index = bucketIndexFor(invoice.paidAt, window.bucketStarts);
    if (index === -1) continue;
    buckets[index]!.subscriptionRevenueCents += invoice.amountPaidCents;
    totals.subscriptionRevenueCents += invoice.amountPaidCents;
  }

  const previousTotals = emptyTotals();
  for (const order of previousOrders) {
    previousTotals.storeRevenueCents += order.totalCents - (order.payment.refundedAmountCents ?? 0);
    previousTotals.orderCount += 1;
  }
  for (const invoice of previousInvoices) {
    previousTotals.subscriptionRevenueCents += invoice.amountPaidCents;
  }

  return { range, buckets, totals, previousTotals };
}

export { getSalesSeries };
export type { SalesBucket, SalesSeries, SalesTotals };
