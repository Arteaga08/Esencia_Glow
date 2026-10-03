import { SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { createPrepaidCycleShipment } from "../services/subscription-shipment.service.js";
import { resolveCycleFromDate } from "../utils/resolve-cycle.js";
import { isCycleStrictlyBetween, dayOfMonthInTimeZone, daysInMonth } from "../services/subscription-prepaid-cycle.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;

interface CreatePrepaidCycleShipmentsSummary {
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Cajas mensuales intermedias de una cuenta PREPAGADA, trimestral o anual
 * (Milestones 2.7b y 3.1.7b) — el webhook de Stripe solo dispara
 * `invoice.paid` una vez por periodo (al alta y en cada renovación), así que
 * este job cubre los ciclos intermedios en cada tick (2 en un trimestre, 11
 * en un año). Nada de la lógica depende del largo del periodo: usa los
 * extremos reales de `currentPeriodStart`/`currentPeriodEnd`.
 *
 * Filtro: `billingInterval` en `quarter`/`year` + `ACTIVE` (incluye `cancelAtPeriodEnd`:
 * el año ya está pagado completo, las cajas siguen llegando hasta el fin del
 * período). `PAST_DUE`/`PAUSED`/`CANCELED`/`INCOMPLETE` quedan fuera — sin
 * cobro confirmado no hay caja que enviar.
 *
 * El ancla es la de CADA cuenta (el día del mes de su propio
 * `currentPeriodEnd`), no `Settings.subscriptions.billingAnchorDay`: ese
 * default puede cambiar a mitad de año sin mover el período ya contratado.
 * `isCycleStrictlyBetween` excluye los dos extremos (alta y renovación): esos
 * los crea el webhook de `invoice.paid`, nunca este job — evita el
 * `duplicate_cycle` que produciría crear la misma caja dos veces por rutas
 * distintas.
 *
 * `coveringInvoiceRef` viaja como `account.latestInvoiceId` (lo escribe
 * `subscription-billing.service.ts::recordPaidInvoice` al procesar la
 * factura prepagada) — es solo informativo (`prepaidInvoiceId`, ver el modelo),
 * la idempotencia real es el índice único de `{accountId, cycleYear,
 * cycleMonth}`.
 */
async function createPrepaidCycleShipments(
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<CreatePrepaidCycleShipmentsSummary> {
  const currentCycle = resolveCycleFromDate(now);
  const today = dayOfMonthInTimeZone(now);

  const candidates = await SubscriptionAccount.find({
    billingInterval: { $in: ["quarter", "year"] },
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: { $exists: true },
    currentPeriodEnd: { $exists: true },
  })
    .select("_id userId planId billingInterval currentPeriodStart currentPeriodEnd latestInvoiceId")
    .limit(batchSize)
    .lean();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const account of candidates) {
    try {
      const startCycle = resolveCycleFromDate(account.currentPeriodStart!);
      const endCycle = resolveCycleFromDate(account.currentPeriodEnd!);
      if (!isCycleStrictlyBetween(currentCycle, startCycle, endCycle)) {
        skipped += 1;
        continue;
      }

      // Acotado a los días del mes EN CURSO (hallazgo de `/code-review`): el
      // ancla de la cuenta es un día fijo (p. ej. 31, de una alta el 31 de
      // enero). Sin este `Math.min`, ningún día de un mes más corto (febrero
      // para ancla 29-31; abril/junio/septiembre/noviembre para ancla 31)
      // cumple nunca `today >= anchorDay` — la caja de ese ciclo no se crea
      // jamás, en silencio, porque el reloj avanza de mes antes de que
      // `today` pueda alcanzar ese número.
      const anchorDay = Math.min(
        dayOfMonthInTimeZone(account.currentPeriodEnd!),
        daysInMonth(currentCycle.cycleYear, currentCycle.cycleMonth),
      );
      if (today < anchorDay) {
        skipped += 1;
        continue;
      }

      const result = await createPrepaidCycleShipment({
        accountId: account._id,
        userId: account.userId,
        planId: account.planId,
        coveringInvoiceRef: account.latestInvoiceId ?? `${account.billingInterval}:${account._id.toString()}`,
        cycleYear: currentCycle.cycleYear,
        cycleMonth: currentCycle.cycleMonth,
      });
      if (result.outcome === "created") created += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        { err: error, accountId: account._id.toString() },
        "Fallo al crear la caja prepagada de un ciclo trimestral o anual",
      );
    }
  }

  return { scanned: candidates.length, created, skipped, failed };
}

export { createPrepaidCycleShipments };
export type { CreatePrepaidCycleShipmentsSummary };
