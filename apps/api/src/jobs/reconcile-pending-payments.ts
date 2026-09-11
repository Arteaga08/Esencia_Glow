import { OrderStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { settleCapturedPayment } from "../services/payment-settlement.service.js";
import { resolvePaymentProvider, type PaymentProvider } from "../services/payment-provider.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_RECONCILE_AFTER_MINUTES = 10;

interface ReconcilePendingPaymentsSummary {
  scanned: number;
  reconciled: number;
  failed: number;
}

/**
 * Respaldo para webhooks perdidos (§D del plan de 1.6): un pedido `pending`
 * con `PaymentIntent` que lleva más de `reconcileAfterMinutes` esperando le
 * pregunta a Stripe la misma pregunta que el webhook contestaría. Corre en
 * el mismo tick del cron — nunca antes de que el pedido tenga tiempo real
 * de resolverse solo (el umbral evita consultar de más).
 *
 * `lastCheckedAt` es el backoff: sin él, cada tick volvería a preguntar por
 * el mismo pedido pendiente, multiplicando llamadas a Stripe sin necesidad.
 */
// Verificado con `.explain("executionStats")`: el índice `{status:1,
// createdAt:-1}` que ya sirve al panel de 1.5 cubre esta consulta
// (IXSCAN sobre status+createdAt, sin COLLSCAN) — no se necesita un
// índice nuevo, los pedidos `pending` son pocos por diseño (uno por
// usuaria, ver índice único parcial de Order).
async function reconcilePendingPayments(
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
  provider?: PaymentProvider,
  reconcileAfterMinutes: number = DEFAULT_RECONCILE_AFTER_MINUTES,
): Promise<ReconcilePendingPaymentsSummary> {
  const resolvedProvider = provider ?? resolvePaymentProvider();
  if (!resolvedProvider) {
    return { scanned: 0, reconciled: 0, failed: 0 };
  }

  const threshold = new Date(now.getTime() - reconcileAfterMinutes * 60_000);
  const candidates = await Order.find({
    status: OrderStatus.PENDING,
    "payment.intentId": { $exists: true },
    createdAt: { $lt: threshold },
    $or: [{ "payment.lastCheckedAt": { $exists: false } }, { "payment.lastCheckedAt": { $lt: threshold } }],
  })
    .select("_id payment.intentId")
    .limit(batchSize)
    .lean();

  let reconciled = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const authorization = await resolvedProvider.getAuthorization(candidate.payment.intentId!);
      if (authorization.status === "captured") {
        const result = await settleCapturedPayment(candidate._id.toString(), authorization);
        if (result.outcome === "paid") reconciled += 1;
      } else {
        await Order.updateOne({ _id: candidate._id }, { $set: { "payment.lastCheckedAt": now } });
      }
    } catch (error) {
      failed += 1;
      logger.error({ err: error, orderId: candidate._id.toString() }, "Fallo al reconciliar un pago pendiente");
    }
  }

  return { scanned: candidates.length, reconciled, failed };
}

export { reconcilePendingPayments };
export type { ReconcilePendingPaymentsSummary };
