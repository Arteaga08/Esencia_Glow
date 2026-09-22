import { OrderAction, OrderStatus } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import { recordAudit } from "./audit.service.js";
import { markOrderPaid } from "./order-payment.service.js";
import { ALL_ORDER_STATUSES } from "./order-state.js";
import { triggerLabelGeneration } from "./order-label-trigger.js";
import { sendPaymentReceivedEmail } from "./order-email.service.js";
import type { PaymentAuthorization } from "./payment-provider.js";

/**
 * `settleCapturedPayment` — único camino que transiciona una orden a `paid`
 * cuando Stripe confirma el cobro. Usado por el webhook (1.6.2) y por el
 * reconciliador (1.6.1, para pedidos sin webhook): ambos consultan a Stripe
 * (`PaymentAuthorization`) y le piden a esta función que decida el efecto,
 * nunca escriben `status`/`payment.state` directo.
 */

type SettlementOutcome = "paid" | "already_paid" | "inventory_incident" | "amount_mismatch" | "late_payment";

interface SettlementResult {
  outcome: SettlementOutcome;
  order: OrderDocument | null;
}

/** Estados por los que una orden YA pasó `paid`: un evento de pago repetido
 * que la encuentra ahí es el mismo pago ya procesado, no una anomalía. Con la
 * guía automática (1.9) la orden avanza sola a `processing` segundos después
 * de pagarse, así que ya no basta comparar contra `paid`. Solo `pending`
 * (aún no se paga) y `cancelled` (pago tardío real) quedan fuera. */
const ALREADY_PAID_STATUSES: ReadonlySet<OrderStatus> = new Set(
  ALL_ORDER_STATUSES.filter((status) => status !== OrderStatus.PENDING && status !== OrderStatus.CANCELLED),
);

/** Un desajuste de monto/moneda o un pago que llega sobre una orden ya
 * cerrada (cancelada/expirada) NUNCA transiciona ni finge éxito — se marca
 * para revisión humana. `adminAlertedAt` se sella una sola vez por
 * incidente (no se pisa si ya estaba). */
async function flagAnomaly(orderId: string, outcome: SettlementOutcome): Promise<SettlementResult> {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, adminAlertedAt: { $exists: false } },
    { $set: { adminAlertedAt: new Date() } },
    { new: true },
  );
  const finalOrder = order ?? (await Order.findById(orderId));
  await recordAudit({
    action: OrderAction.ORDER_PAYMENT_ANOMALY,
    targetId: orderId,
    metadata: { outcome, orderNumber: finalOrder?.orderNumber ?? "" },
  });
  return { outcome, order: finalOrder };
}

async function settleCapturedPayment(
  orderId: string,
  authorization: Pick<PaymentAuthorization, "intentId" | "amountCents" | "currency" | "card">,
): Promise<SettlementResult> {
  const order = await Order.findById(orderId);
  if (!order) return { outcome: "late_payment", order: null };

  if (ALREADY_PAID_STATUSES.has(order.status)) {
    return { outcome: "already_paid", order };
  }

  if (order.status !== OrderStatus.PENDING) {
    // Pago capturado sobre una orden ya cerrada (cancelada/expirada) — el
    // stock de esa orden ya se soltó o nunca se comprometió por esta vía.
    return flagAnomaly(orderId, "late_payment");
  }

  if (order.totalCents !== authorization.amountCents || order.currency !== authorization.currency.toUpperCase()) {
    return flagAnomaly(orderId, "amount_mismatch");
  }

  const result = await markOrderPaid({
    orderId,
    intentId: authorization.intentId,
    ...(authorization.card ? { card: authorization.card } : {}),
  });

  // Correo de pago recibido (§8 del plan de 1.6.3): cubre webhook,
  // reconciliador y el `already_captured` de `closePendingOrder` — los tres
  // llaman aquí. Un replay (`already_paid`) NO reenvía.
  if (result.outcome !== "already_paid") {
    void sendPaymentReceivedEmail(orderId);
  }

  // Guía de envío (1.9): SOLO cuando el pago realmente se confirmó. Un
  // `inventory_incident` (la orden quedó `paid` pero sin guía encolada) espera
  // revisión humana; un replay ya la disparó la primera vez.
  if (result.outcome === "paid") {
    triggerLabelGeneration(orderId);
  }

  return { outcome: result.outcome as SettlementOutcome, order: result.order };
}

export { settleCapturedPayment };
export type { SettlementOutcome, SettlementResult };
