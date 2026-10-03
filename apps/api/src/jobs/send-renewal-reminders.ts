import { SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { sendRenewalReminderEmail } from "../services/subscription-email.service.js";
import type { PrepaidInterval } from "../services/subscription-billing-interval.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Días de anticipación del aviso por intervalo (decisión de Manuel): un
 * cobro recurrente sin aviso es la causa #1 de contracargo por "no reconozco
 * este cargo" — mismo motivo que ya justificó el correo de confirmación de
 * cada cobro en 1.7.2a. El trimestral avisa a 7 días (30 serían un tercio del
 * periodo), el anual a 30 (Milestones 2.7b y 3.1.7b). */
const RENEWAL_REMINDER_DAYS: Record<PrepaidInterval, number> = { quarter: 7, year: 30 };

interface SendRenewalRemindersSummary {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Aviso antes de que se renueve un ciclo PREPAGADO. Filtro: `billingInterval`
 * `quarter`/`year` + `ACTIVE` + `!cancelAtPeriodEnd` (quien ya canceló no
 * necesita el recordatorio) + `currentPeriodEnd` dentro de la ventana
 * `(now, now + RENEWAL_REMINDER_DAYS[intervalo]]`.
 *
 * Claim atómico sobre `renewalReminderSentFor` ANTES de enviar (mismo
 * criterio que el resto de la doctrina del proyecto: nunca "enviar y
 * marcar" en ese orden, porque dos ticks concurrentes mandarían el correo
 * dos veces) — `$ne: currentPeriodEnd` es la guarda: si el período ya
 * cambió (una renovación cerró el ciclo viejo y abrió uno nuevo), el claim
 * vuelve a tomar porque el valor sellado ya no coincide.
 */
async function sendRenewalReminders(
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<SendRenewalRemindersSummary> {
  const candidates = await SubscriptionAccount.find({
    status: SubscriptionStatus.ACTIVE,
    cancelAtPeriodEnd: false,
    $or: (Object.keys(RENEWAL_REMINDER_DAYS) as PrepaidInterval[]).map((interval) => ({
      billingInterval: interval,
      currentPeriodEnd: { $gt: now, $lte: new Date(now.getTime() + RENEWAL_REMINDER_DAYS[interval] * DAY_MS) },
    })),
  })
    .select("_id userId currentPeriodEnd billingInterval")
    .limit(batchSize)
    .lean();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const account of candidates) {
    try {
      const claimed = await SubscriptionAccount.findOneAndUpdate(
        { _id: account._id, renewalReminderSentFor: { $ne: account.currentPeriodEnd } },
        { $set: { renewalReminderSentFor: account.currentPeriodEnd } },
      );
      if (!claimed) {
        skipped += 1;
        continue;
      }

      await sendRenewalReminderEmail({
        accountId: account._id.toString(),
        userId: account.userId,
        periodEnd: account.currentPeriodEnd!,
        billingInterval: account.billingInterval as PrepaidInterval,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        { err: error, accountId: account._id.toString() },
        "Fallo al enviar el aviso de renovación",
      );
    }
  }

  return { scanned: candidates.length, sent, skipped, failed };
}

export { sendRenewalReminders, RENEWAL_REMINDER_DAYS };
export type { SendRenewalRemindersSummary };
