import { OrderAction, OrderStatus } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import { recordAudit } from "./audit.service.js";
import { markOrderPaid } from "./order-payment.service.js";
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

  if (order.status === OrderStatus.PAID) {
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

  return { outcome: result.outcome as SettlementOutcome, order: result.order };
}

export { settleCapturedPayment };
export type { SettlementOutcome, SettlementResult };
