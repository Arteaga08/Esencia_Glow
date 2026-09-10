import cron, { type ScheduledTask } from "node-cron";
import { releaseExpiredReservations } from "./release-expired-reservations.js";
import { getSettings } from "../services/settings.service.js";
import { logger } from "../config/logger.js";

/**
 * Barrendero de reservas vencidas. Corre cada minuto — más frecuente que el
 * TTL de reservas típico (30 min por defecto), así que una reserva vencida
 * no deja stock apartado más de un minuto de más.
 *
 * `noOverlap: true` es la guarda nativa de node-cron v4 contra dos ticks
 * solapados en ESTE proceso si un barrido tarda más que el intervalo; el
 * solapamiento ENTRE instancias de la API es inofensivo porque
 * `releaseReservationDetailed` hace un claim atómico por documento (ver
 * release-expired-reservations.ts) — ninguna de las dos guardas reemplaza a
 * la otra, cada una cubre un caso distinto.
 *
 * Nunca se monta en `buildApp()`: ningún test de supertest debe levantar
 * timers de cron.
 */
let task: ScheduledTask | undefined;

function startCronJobs(): void {
  if (task) return;

  task = cron.schedule(
    "* * * * *",
    async () => {
      const settings = await getSettings();
      const summary = await releaseExpiredReservations(new Date(), settings.inventory.sweepBatchSize);
      if (summary.released > 0 || summary.failed > 0) {
        logger.info(summary, "Barrido de reservas vencidas");
      }
    },
    { noOverlap: true, name: "release-expired-reservations" },
  );
}

async function stopCronJobs(): Promise<void> {
  if (!task) return;
  await task.stop();
  task = undefined;
}

export { startCronJobs, stopCronJobs };
