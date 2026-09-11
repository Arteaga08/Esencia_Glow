import { MAX_STATUS_HISTORY, OrderAction, OrderStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { withTransaction } from "../utils/with-transaction.js";
import { releaseReservationDetailed, auditReleaseMismatches } from "../services/stock-reservation.service.js";
import { recordAudit } from "../services/audit.service.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;
const EXPIRED_ORDER_CANCEL_REASON = "La reserva de stock expiró antes del pago.";

interface CancelExpiredOrdersSummary {
  scanned: number;
  cancelled: number;
  failed: number;
}

/**
 * Barrendero de órdenes `pending` vencidas — corre en el MISMO tick del
 * cron, DESPUÉS de `releaseExpiredReservations` (ver plan de 1.5 §E). No
 * se apoya en el TTL de Mongo sobre la orden (borraría el registro
 * contable) ni en "expirado derivado en lectura" (`status` mentiría en
 * reportes).
 *
 * El claim (`findOneAndUpdate` con `status: pending` en el filtro) y el
 * `release` de la reserva viajan en la MISMA transacción: si esta llamada
 * gana el claim pero el otro barrendero (o `markOrderPaid`) ya liberó/comprometió
 * la reserva por su cuenta, `releaseReservationDetailed` es un no-op seguro
 * (`transitioned: false`) — nunca dos releases del mismo stock.
 */
async function cancelExpiredOrders(
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<CancelExpiredOrdersSummary> {
  const expired = await Order.find({ status: OrderStatus.PENDING, expiresAt: { $lt: now } })
    .select("_id")
    .limit(batchSize)
    .lean();

  let cancelled = 0;
  let failed = 0;

  for (const { _id } of expired) {
    try {
      const result = await withTransaction(async (session) => {
        const claimed = await Order.findOneAndUpdate(
          { _id, status: OrderStatus.PENDING },
          {
            $set: { status: OrderStatus.CANCELLED, cancelReason: EXPIRED_ORDER_CANCEL_REASON },
            $push: {
              statusHistory: {
                $each: [{ status: OrderStatus.CANCELLED, at: now, actorType: "system" }],
                $slice: -MAX_STATUS_HISTORY,
              },
            },
          },
          { new: true, session },
        );
        if (!claimed) return { transitioned: false as const };

        const release = await releaseReservationDetailed(claimed.reservationId.toString(), session);
        return { transitioned: true as const, order: claimed, releaseResult: release };
      });

      if (result.transitioned) {
        cancelled += 1;
        if (result.releaseResult.inconsistentVariants.length > 0) {
          await auditReleaseMismatches(result.order.reservationId.toString(), result.releaseResult.inconsistentVariants);
        }
        await recordAudit({
          action: OrderAction.ORDER_EXPIRED,
          targetId: result.order._id,
          metadata: { orderNumber: result.order.orderNumber },
        });
      }
    } catch (error) {
      failed += 1;
      logger.error({ err: error, orderId: _id.toString() }, "Fallo al cancelar un pedido vencido");
    }
  }

  return { scanned: expired.length, cancelled, failed };
}

export { cancelExpiredOrders };
export type { CancelExpiredOrdersSummary };
