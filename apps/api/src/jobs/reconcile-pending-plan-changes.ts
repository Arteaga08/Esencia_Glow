import { SubscriptionAction } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { recordAudit } from "../services/audit.service.js";
import { resolveSubscriptionProvider } from "../services/subscription-provider.js";
import { abortPlanChange, finalizePlanChange } from "../services/subscription-plan-change.service.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;

/** Un `changePlan` sano resuelve su marcador en segundos (una llamada a
 * Stripe): pasado este umbral el proceso que lo dejó murió, o Stripe dio un
 * error ambiguo y `changePlan` conservó el marcador a propósito. Este job es
 * el ÚNICO camino de recuperación — no hay atajo por webhook, porque un
 * `.updated` no trae orden y no es evidencia de que el cambio aplicó. */
const DEFAULT_STALE_MINUTES = 5;

interface ReconcilePendingPlanChangesSummary {
  scanned: number;
  finalized: number;
  aborted: number;
  failed: number;
}

/**
 * Barrendero de cambios de plan a medias (Milestone 1.7.3) — la red de
 * seguridad del caso "el proceso murió entre reclamar el cupo del plan nuevo y
 * confirmarlo contra Stripe" y el caso de un error AMBIGUO de Stripe (timeout: el
 * cambio pudo aplicarse), ver `subscription-plan-change.service.ts`. Es el
 * único camino de recuperación.
 *
 * Pregunta a Stripe qué precio tiene HOY la suscripción: si ya es el del plan
 * nuevo, finaliza; si sigue el viejo (o la cuenta nunca llegó a tener ref),
 * aborta. Ambas resoluciones son idempotentes y seguras en carrera (CAS sobre
 * `requestedAt`): si otro camino consumió el marcador entre medias, el
 * resultado es `noop` y no se cuenta ni se audita.
 *
 * Sin proveedor configurado (entorno sin Stripe) no hace nada — nunca lanza.
 */
async function reconcilePendingPlanChanges(
  now: Date = new Date(),
  thresholdMinutes: number = DEFAULT_STALE_MINUTES,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<ReconcilePendingPlanChangesSummary> {
  const provider = resolveSubscriptionProvider();
  if (!provider) return { scanned: 0, finalized: 0, aborted: 0, failed: 0 };

  const threshold = new Date(now.getTime() - thresholdMinutes * 60_000);
  const stale = await SubscriptionAccount.find({ "pendingPlanChange.requestedAt": { $lt: threshold } })
    .select("_id providerSubscriptionId pendingPlanChange")
    .limit(batchSize)
    .lean();

  let finalized = 0;
  let aborted = 0;
  let failed = 0;

  for (const account of stale) {
    const pending = account.pendingPlanChange;
    if (!pending) continue;

    try {
      const confirmed = await isPriceConfirmed(provider, account.providerSubscriptionId, pending.planId);
      const outcome = confirmed
        ? await finalizePlanChange(account._id, pending.requestedAt)
        : await abortPlanChange(account._id, pending.requestedAt);
      if (outcome === "noop") continue;

      await recordAudit({
        action: SubscriptionAction.SUBSCRIPTION_PLAN_CHANGE_RECONCILED,
        targetId: account._id,
        metadata: { outcome },
      });
      if (outcome === "finalized") finalized += 1;
      else aborted += 1;
    } catch (error) {
      failed += 1;
      logger.error({ err: error, accountId: account._id.toString() }, "Fallo al reconciliar un cambio de plan a medias");
    }
  }

  return { scanned: stale.length, finalized, aborted, failed };
}

/** ¿Stripe ya aplicó el precio del plan nuevo? Sin ref de suscripción, Stripe
 * nunca se tocó: no hay nada que confirmar. */
async function isPriceConfirmed(
  provider: NonNullable<ReturnType<typeof resolveSubscriptionProvider>>,
  subscriptionRef: string | undefined,
  newPlanId: unknown,
): Promise<boolean> {
  if (!subscriptionRef) return false;

  const [plan, subscription] = await Promise.all([
    SubscriptionPlan.findById(newPlanId).select("providerPriceId").lean(),
    provider.getSubscription(subscriptionRef),
  ]);
  return Boolean(plan?.providerPriceId) && subscription.priceRef === plan?.providerPriceId;
}

export { reconcilePendingPlanChanges };
export type { ReconcilePendingPlanChangesSummary };
