import { OrderStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { closePendingOrder } from "../services/order-closing.service.js";
import type { PaymentProvider } from "../services/payment-provider.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;

interface CancelExpiredOrdersSummary {
  scanned: number;
  cancelled: number;
  failed: number;
}

/**
 * Barrendero de órdenes `pending` vencidas — corre en el MISMO tick del
 * cron, DESPUÉS de `releaseExpiredReservations` (ver plan de 1.5 §E).
 * Delega en `closePendingOrder` (Milestone 1.6 §D): "Stripe-first" — si el
 * pedido ya tiene un PaymentIntent, se consulta/cancela en Stripe ANTES de
 * tocar inventario, para nunca cancelar un pedido cuyo pago ya se procesó
 * (un webhook perdido no debe convertirse en una cancelación indebida).
 */
async function cancelExpiredOrders(
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
  provider?: PaymentProvider,
): Promise<CancelExpiredOrdersSummary> {
  const expired = await Order.find({ status: OrderStatus.PENDING, expiresAt: { $lt: now } })
    .select("_id")
    .limit(batchSize)
    .lean();

  let cancelled = 0;
  let failed = 0;

  for (const { _id } of expired) {
    try {
      const result = await closePendingOrder(_id.toString(), "system", {
        reason: "La reserva de stock expiró antes del pago.",
        ...(provider !== undefined ? { provider } : {}),
      });
      if (result.transitioned) cancelled += 1;
      // outcome === "already_paid": Stripe-first evitó cancelar un pedido
      // cuyo pago ya se procesó — settleCapturedPayment ya lo dejó `paid`.
    } catch (error) {
      failed += 1;
      logger.error({ err: error, orderId: _id.toString() }, "Fallo al cerrar un pedido vencido");
    }
  }

  return { scanned: expired.length, cancelled, failed };
}

export { cancelExpiredOrders };
export type { CancelExpiredOrdersSummary };
