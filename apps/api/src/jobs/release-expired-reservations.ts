import { InventoryAction, ReservationStatus } from "@esencia-glow/shared";
import { StockReservation } from "../models/stock-reservation.model.js";
import { releaseReservationDetailed } from "../services/stock-reservation.service.js";
import { recordAudit } from "../services/audit.service.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;

interface SweepSummary {
  scanned: number;
  released: number;
  failed: number;
}

/**
 * Función pura, invocable directo desde tests o desde `jobs/index.ts` (que la
 * agenda con node-cron). Nunca usa `updateMany`: lista los `_id` vencidos y
 * llama a la MISMA `releaseReservation` que usa la API, una transacción por
 * reserva. Eso es lo que hace seguro correr esto en N instancias sin lock
 * distribuido — el claim atómico por documento de `releaseReservation`
 * basta, y un crash a mitad de un lote no deja ninguna reserva a medio
 * liberar (cada una es o no es, nunca "parcialmente").
 */
async function releaseExpiredReservations(
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<SweepSummary> {
  const expired = await StockReservation.find({
    status: ReservationStatus.ACTIVE,
    expiresAt: { $lt: now },
  })
    .select("_id")
    .limit(batchSize)
    .lean();

  let released = 0;
  let failed = 0;

  for (const { _id } of expired) {
    try {
      const { transitioned } = await releaseReservationDetailed(_id.toString());
      // Solo cuenta si ESTA llamada hizo la transición: bajo dos ejecuciones
      // concurrentes del barrendero, la perdedora encuentra el estado ya
      // terminal y no debe inflar el conteo de liberaciones reales.
      if (transitioned) {
        released += 1;
        // Emisor pendiente de 1.4 (declarado sin actor humano al que
        // atribuirlo); 1.5 lo conecta aquí — el cron SÍ tiene contexto
        // (una reserva concreta que venció), aunque sin `actorId` (system).
        await recordAudit({ action: InventoryAction.RESERVATION_EXPIRED, targetId: _id });
      }
    } catch (error) {
      failed += 1;
      logger.error({ err: error, reservationId: _id.toString() }, "Fallo al liberar una reserva vencida");
    }
  }

  return { scanned: expired.length, released, failed };
}

export { releaseExpiredReservations };
export type { SweepSummary };
