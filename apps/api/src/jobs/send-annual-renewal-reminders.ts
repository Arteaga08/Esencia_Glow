import { SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { sendAnnualRenewalReminderEmail } from "../services/subscription-email.service.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Días de anticipación del aviso (decisión de Manuel, Milestone 2.7b): un
 * cobro recurrente sin aviso es la causa #1 de contracargo por "no
 * reconozco este cargo" — mismo motivo que ya justificó el correo de
 * confirmación de cada cobro en 1.7.2a. */
const ANNUAL_RENEWAL_REMINDER_DAYS = 30;

interface SendAnnualRenewalRemindersSummary {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Aviso 30 días antes de que se renueve un ciclo ANUAL. Filtro:
 * `billingInterval: "year"` + `ACTIVE` + `!cancelAtPeriodEnd` (quien ya
 * canceló no necesita el recordatorio) + `currentPeriodEnd` dentro de la
 * ventana `(now, now + 30 días]`.
 *
 * Claim atómico sobre `renewalReminderSentFor` ANTES de enviar (mismo
 * criterio que el resto de la doctrina del proyecto: nunca "enviar y
 * marcar" en ese orden, porque dos ticks concurrentes mandarían el correo
 * dos veces) — `$ne: currentPeriodEnd` es la guarda: si el período ya
 * cambió (una renovación cerró el ciclo viejo y abrió uno nuevo), el claim
 * vuelve a tomar porque el valor sellado ya no coincide.
 */
async function sendAnnualRenewalReminders(
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<SendAnnualRenewalRemindersSummary> {
  const windowEnd = new Date(now.getTime() + ANNUAL_RENEWAL_REMINDER_DAYS * DAY_MS);

  const candidates = await SubscriptionAccount.find({
    billingInterval: "year",
    status: SubscriptionStatus.ACTIVE,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: { $gt: now, $lte: windowEnd },
  })
    .select("_id userId currentPeriodEnd")
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

      await sendAnnualRenewalReminderEmail({
        accountId: account._id.toString(),
        userId: account.userId,
        periodEnd: account.currentPeriodEnd!,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        { err: error, accountId: account._id.toString() },
        "Fallo al enviar el aviso de renovación anual",
      );
    }
  }

  return { scanned: candidates.length, sent, skipped, failed };
}

export { sendAnnualRenewalReminders, ANNUAL_RENEWAL_REMINDER_DAYS };
export type { SendAnnualRenewalRemindersSummary };
