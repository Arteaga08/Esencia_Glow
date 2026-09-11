import cron, { type ScheduledTask } from "node-cron";
import { releaseExpiredReservations } from "./release-expired-reservations.js";
import { refreshBundleStockCaches } from "./refresh-bundle-stock-cache.js";
import { cancelExpiredOrders } from "./cancel-expired-orders.js";
import { reconcilePendingPayments } from "./reconcile-pending-payments.js";
import { getSettings } from "../services/settings.service.js";
import { env } from "../config/env.js";
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
 * El mismo tick también refresca `Bundle.stockCache` (1.4.1): es una caché de
 * display, no fuente de verdad, así que no amerita su propio cron — viaja en
 * el que ya existe.
 *
 * `cancelExpiredOrders` (1.5) espera a que `releaseExpiredReservations`
 * resuelva antes de correr: una orden `pending` vencida necesita que su
 * reserva ya se procese en este mismo tick, y el orden importa para que el
 * log de un tick lea como una secuencia causal (libera reservas -> cancela
 * las órdenes que dependían de ellas), aunque `cancelExpiredOrders` es
 * también segura si corre antes — su propio `releaseReservationDetailed` es
 * un no-op idempotente si la reserva ya se liberó. `refreshBundleStockCaches`
 * NO depende de ninguna de las dos, así que arranca en paralelo con
 * `releaseExpiredReservations` — encadenarla detrás perdería su aislamiento
 * de fallos: si `releaseExpiredReservations` rechaza, `Bundle.stockCache`
 * (una caché de display) no tiene por qué dejar de refrescarse ese tick.
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
      // Independiente de los barridos de reserva/orden de abajo (una
      // orden colgada no depende de que además haya vencido su reserva):
      // arranca en paralelo con el refresco de bundles, no encadenada
      // detrás de la cadena reserva->orden, para no sumar una llamada de
      // red a Stripe por pedido al tiempo secuencial de cada tick.
      const bundleSummaryPromise = refreshBundleStockCaches(settings.inventory.sweepBatchSize);
      const reconcileSummaryPromise = reconcilePendingPayments(
        new Date(),
        settings.inventory.sweepBatchSize,
        undefined,
        env.paymentReconcileAfterMinutes,
      );
      const reservationSummary = await releaseExpiredReservations(new Date(), settings.inventory.sweepBatchSize);
      const orderSummary = await cancelExpiredOrders(new Date(), settings.inventory.sweepBatchSize);
      const bundleSummary = await bundleSummaryPromise;
      const reconcileSummary = await reconcileSummaryPromise;
      if (reservationSummary.released > 0 || reservationSummary.failed > 0) {
        logger.info(reservationSummary, "Barrido de reservas vencidas");
      }
      if (orderSummary.cancelled > 0 || orderSummary.failed > 0) {
        logger.info(orderSummary, "Barrido de pedidos pending vencidos");
      }
      if (reconcileSummary.reconciled > 0 || reconcileSummary.failed > 0) {
        logger.info(reconcileSummary, "Reconciliación de pagos pendientes");
      }
      if (bundleSummary.updated > 0 || bundleSummary.failed > 0) {
        logger.info(bundleSummary, "Refresco de stockCache de bundles");
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
