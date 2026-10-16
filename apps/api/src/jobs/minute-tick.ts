import { releaseExpiredReservations } from "./release-expired-reservations.js";
import { refreshBundleStockCaches } from "./refresh-bundle-stock-cache.js";
import { cancelExpiredOrders } from "./cancel-expired-orders.js";
import { reconcilePendingPayments } from "./reconcile-pending-payments.js";
import { expireIncompleteSubscriptions } from "./expire-incomplete-subscriptions.js";
import { alertMissingEdition } from "./alert-missing-edition.js";
import { reconcilePendingPlanChanges } from "./reconcile-pending-plan-changes.js";
import { createPrepaidCycleShipments } from "./create-prepaid-cycle-shipments.js";
import { sendRenewalReminders } from "./send-renewal-reminders.js";
import { getSettings } from "../services/settings.service.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Ejecuta UN barrido aislando su fallo (auditoría run-2, hallazgo 15). El
 * `server.ts` convierte cualquier `unhandledRejection` en `process.exit(1)`;
 * un barrido cuya primera consulta rechaza (corte de Mongo, failover) sin
 * manejador tumbaba el API entero. Aquí el `catch` se adjunta al CREAR la
 * promesa —no cuando el tick llegue a hacerle `await`—, así que ningún barrido
 * puede quedar sin manejador aunque otro tarde o falle antes. Registra con
 * `logger.error` (que ya viaja a Sentry) y devuelve el resumen en cero con
 * `failed: 1`; el siguiente minuto se reintenta solo.
 */
function runSweep<T extends { failed: number }>(
  name: string,
  sweep: () => Promise<T>,
  empty: T,
): Promise<T> {
  return sweep().catch((error: unknown) => {
    logger.error({ err: error, sweep: name }, "Falló un barrido del cron");
    return { ...empty, failed: 1 };
  });
}

/** Lee la configuración de los barridos. Si falla (corte de Mongo), registra y
 * devuelve `undefined`: el tick se salta y el siguiente minuto reintenta, en
 * vez de rechazar el callback del cron. */
async function readSettingsOrSkip(
  name: string,
): Promise<Awaited<ReturnType<typeof getSettings>> | undefined> {
  try {
    return await getSettings();
  } catch (error) {
    logger.error({ err: error, sweep: name }, "No se pudo leer la configuración; se omite el tick");
    return undefined;
  }
}

const EMPTY_SWEEP = { scanned: 0, failed: 0 };

/**
 * Cuerpo del tick por minuto de `startCronJobs` (ver su docstring en
 * `index.ts` para el porqué del orden y del paralelismo). Vive aparte para
 * poder probarlo sin node-cron.
 */
async function runMinuteTick(): Promise<void> {
  const settings = await readSettingsOrSkip("minute-tick");
  if (!settings) return;
  const batch = settings.inventory.sweepBatchSize;
  const now = () => new Date();

  // Independientes de la cadena reserva->orden: arrancan en paralelo, cada una
  // con su manejador de errores ya adjunto (ver `runSweep`).
  const bundleSummaryPromise = runSweep(
    "refresh-bundle-stock-caches",
    () => refreshBundleStockCaches(batch),
    { ...EMPTY_SWEEP, updated: 0 },
  );
  const reconcileSummaryPromise = runSweep(
    "reconcile-pending-payments",
    () => reconcilePendingPayments(now(), batch, undefined, env.paymentReconcileAfterMinutes),
    { ...EMPTY_SWEEP, reconciled: 0 },
  );
  const expireSubscriptionsSummaryPromise = runSweep(
    "expire-incomplete-subscriptions",
    () => expireIncompleteSubscriptions(now(), env.subscriptionIncompleteExpireMinutes, batch),
    { ...EMPTY_SWEEP, expired: 0 },
  );
  const missingEditionSummaryPromise = runSweep(
    "alert-missing-edition",
    () =>
      alertMissingEdition(
        now(),
        settings.subscriptions.billingAnchorDay,
        env.subscriptionEditionAlertDays,
        batch,
      ),
    { ...EMPTY_SWEEP, alerted: 0 },
  );
  const planChangeSummaryPromise = runSweep(
    "reconcile-pending-plan-changes",
    () => reconcilePendingPlanChanges(now(), undefined, batch),
    { ...EMPTY_SWEEP, finalized: 0, aborted: 0 },
  );
  const prepaidShipmentsSummaryPromise = runSweep(
    "create-prepaid-cycle-shipments",
    () => createPrepaidCycleShipments(now(), batch),
    { ...EMPTY_SWEEP, created: 0, skipped: 0 },
  );
  const renewalReminderSummaryPromise = runSweep(
    "send-renewal-reminders",
    () => sendRenewalReminders(now(), batch),
    { ...EMPTY_SWEEP, sent: 0, skipped: 0 },
  );

  // Cadena reserva->orden: se conserva el orden causal (libera reservas y
  // luego cancela los pedidos que dependían de ellas). Si la primera falla,
  // la segunda igual corre: su propio release es un no-op idempotente.
  const reservationSummary = await runSweep(
    "release-expired-reservations",
    () => releaseExpiredReservations(now(), batch),
    { ...EMPTY_SWEEP, released: 0 },
  );
  const orderSummary = await runSweep(
    "cancel-expired-orders",
    () => cancelExpiredOrders(now(), batch),
    {
      ...EMPTY_SWEEP,
      cancelled: 0,
    },
  );
  const bundleSummary = await bundleSummaryPromise;
  const reconcileSummary = await reconcileSummaryPromise;
  const expireSubscriptionsSummary = await expireSubscriptionsSummaryPromise;
  const missingEditionSummary = await missingEditionSummaryPromise;
  const planChangeSummary = await planChangeSummaryPromise;
  const prepaidShipmentsSummary = await prepaidShipmentsSummaryPromise;
  const renewalReminderSummary = await renewalReminderSummaryPromise;

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
  if (
    planChangeSummary.finalized > 0 ||
    planChangeSummary.aborted > 0 ||
    planChangeSummary.failed > 0
  ) {
    logger.info(planChangeSummary, "Reconciliación de cambios de plan a medias");
  }
  if (prepaidShipmentsSummary.created > 0 || prepaidShipmentsSummary.failed > 0) {
    logger.info(prepaidShipmentsSummary, "Cajas prepagadas de ciclos intermedios anuales");
  }
  if (renewalReminderSummary.sent > 0 || renewalReminderSummary.failed > 0) {
    logger.info(renewalReminderSummary, "Avisos de renovación de ciclos prepagados");
  }
}

export { readSettingsOrSkip, runMinuteTick, runSweep };
