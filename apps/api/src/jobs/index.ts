import cron, { type ScheduledTask } from "node-cron";
import { readSettingsOrSkip, runMinuteTick, runSweep } from "./minute-tick.js";
import { processShippingLabels } from "./process-shipping-labels.js";
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
 * cadenas de reserva/orden. `createPrepaidCycleShipments` (2.7b) es igual de
 * independiente: crea las cajas mensuales intermedias de las cuentas PREPAGADAS
 * (trimestral/anual), cuyo webhook de Stripe solo dispara `invoice.paid` una vez por periodo.
 * `sendRenewalReminders` (2.7b/3.1.7b) también viaja en paralelo: solo lee y
 * escribe cuentas, sin tocar inventario ni pedidos.
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

  task = cron.schedule("* * * * *", runMinuteTick, {
    noOverlap: true,
    name: "release-expired-reservations",
  });

  // Cron PROPIO (1.9): el barrido de guías hace llamadas secuenciales a un
  // tercero de hasta 30 s cada una. Dentro del tick de arriba, un Skydropx
  // lento retrasaría (por `noOverlap`) la liberación de reservas y la
  // cancelación de pedidos vencidos — stock secuestrado por una caída ajena.
  // Separado, su lentitud solo retrasa a las propias guías.
  labelsTask = cron.schedule(
    "* * * * *",
    async () => {
      const settings = await readSettingsOrSkip("process-shipping-labels");
      if (!settings) return;
      const labelSummary = await runSweep(
        "process-shipping-labels",
        () => processShippingLabels(new Date(), settings.inventory.sweepBatchSize),
        { dispatched: 0, refreshed: 0, reviewed: 0, reconciled: 0, failed: 0 },
      );
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
