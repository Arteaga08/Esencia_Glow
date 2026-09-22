import cron, { type ScheduledTask } from "node-cron";
import { releaseExpiredReservations } from "./release-expired-reservations.js";
import { refreshBundleStockCaches } from "./refresh-bundle-stock-cache.js";
import { cancelExpiredOrders } from "./cancel-expired-orders.js";
import { reconcilePendingPayments } from "./reconcile-pending-payments.js";
import { expireIncompleteSubscriptions } from "./expire-incomplete-subscriptions.js";
import { alertMissingEdition } from "./alert-missing-edition.js";
import { reconcilePendingPlanChanges } from "./reconcile-pending-plan-changes.js";
import { processShippingLabels } from "./process-shipping-labels.js";
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
 * `expireIncompleteSubscriptions` (Milestone 1.7.2a, Fase 5) es igual de
 * independiente: cuentas de suscripción, no órdenes/inventario, así que
 * arranca en paralelo con `refreshBundleStockCaches`/`reconcilePendingPayments`,
 * nunca encadenada detrás de la cadena reserva->orden. Lo mismo vale para
 * `alertMissingEdition` (1.7.2b), que además se corta sola fuera de la
 * ventana de aviso sin tocar la base. `reconcilePendingPlanChanges` (1.7.3)
 * también: resuelve cambios de plan que quedaron a medias, sin depender de las
 * cadenas de reserva/orden.
 *
 * `processShippingLabels` (Milestone 1.9) NO va en este tick sino en su
 * propio cron (al final de `startCronJobs`): sus llamadas a un tercero pueden
 * ser lentas y, dentro de este tick con `noOverlap`, retrasarían la
 * liberación de reservas. Retoma guías cuyo disparo inmediato se perdió,
 * consulta las que el proveedor aún genera, manda a revisión las que quedaron
 * a medias (sin recomprar jamás una guía de resultado desconocido) y completa
 * transiciones de orden que quedaron a medias.
 *
 * Nunca se monta en `buildApp()`: ningún test de supertest debe levantar
 * timers de cron.
 */
let task: ScheduledTask | undefined;
let labelsTask: ScheduledTask | undefined;

function startCronJobs(): void {
  if (task || labelsTask) return;

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
      const expireSubscriptionsSummaryPromise = expireIncompleteSubscriptions(
        new Date(),
        env.subscriptionIncompleteExpireMinutes,
        settings.inventory.sweepBatchSize,
      );
      const missingEditionSummaryPromise = alertMissingEdition(
        new Date(),
        settings.subscriptions.billingAnchorDay,
        env.subscriptionEditionAlertDays,
        settings.inventory.sweepBatchSize,
      );
      const planChangeSummaryPromise = reconcilePendingPlanChanges(
        new Date(),
        undefined,
        settings.inventory.sweepBatchSize,
      );
      const reservationSummary = await releaseExpiredReservations(new Date(), settings.inventory.sweepBatchSize);
      const orderSummary = await cancelExpiredOrders(new Date(), settings.inventory.sweepBatchSize);
      const bundleSummary = await bundleSummaryPromise;
      const reconcileSummary = await reconcileSummaryPromise;
      const expireSubscriptionsSummary = await expireSubscriptionsSummaryPromise;
      const missingEditionSummary = await missingEditionSummaryPromise;
      const planChangeSummary = await planChangeSummaryPromise;
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
      if (expireSubscriptionsSummary.expired > 0 || expireSubscriptionsSummary.failed > 0) {
        logger.info(expireSubscriptionsSummary, "Barrido de suscripciones incompletas vencidas");
      }
      if (missingEditionSummary.alerted > 0 || missingEditionSummary.failed > 0) {
        logger.info(missingEditionSummary, "Aviso preventivo de ediciones faltantes");
      }
      if (planChangeSummary.finalized > 0 || planChangeSummary.aborted > 0 || planChangeSummary.failed > 0) {
        logger.info(planChangeSummary, "Reconciliación de cambios de plan a medias");
      }
    },
    { noOverlap: true, name: "release-expired-reservations" },
  );

  // Cron PROPIO (1.9): el barrido de guías hace llamadas secuenciales a un
  // tercero de hasta 30 s cada una. Dentro del tick de arriba, un Skydropx
  // lento retrasaría (por `noOverlap`) la liberación de reservas y la
  // cancelación de pedidos vencidos — stock secuestrado por una caída ajena.
  // Separado, su lentitud solo retrasa a las propias guías.
  labelsTask = cron.schedule(
    "* * * * *",
    async () => {
      const settings = await getSettings();
      const labelSummary = await processShippingLabels(new Date(), settings.inventory.sweepBatchSize);
      if (
        labelSummary.dispatched > 0 ||
        labelSummary.refreshed > 0 ||
        labelSummary.reviewed > 0 ||
        labelSummary.reconciled > 0 ||
        labelSummary.failed > 0
      ) {
        logger.info(labelSummary, "Barrido de guías de envío");
      }
    },
    { noOverlap: true, name: "process-shipping-labels" },
  );
}

async function stopCronJobs(): Promise<void> {
  await Promise.all([task?.stop(), labelsTask?.stop()]);
  task = undefined;
  labelsTask = undefined;
}

export { startCronJobs, stopCronJobs };
