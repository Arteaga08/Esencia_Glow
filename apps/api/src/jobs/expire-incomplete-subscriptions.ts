import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { applyStatusTransition } from "../services/subscription-seat.service.js";
import { recordAudit } from "../services/audit.service.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;

interface ExpireIncompleteSubscriptionsSummary {
  scanned: number;
  expired: number;
  failed: number;
}

/**
 * Barrendero de cuentas `INCOMPLETE` sin `providerSubscriptionId` (Fase 5 de
 * 1.7.2a, §E del plan) — red de seguridad para el caso "el proceso murió
 * entre reclamar el cupo y compensar" que `subscription-start.service.ts`
 * deja documentado y aceptado: si `compensateFailedStart` mismo falla (o el
 * proceso muere antes de llegar al `catch`), la cuenta se queda `INCOMPLETE`
 * para siempre sin este barrendero.
 *
 * `providerSubscriptionId: {$exists: false}` es la guarda crítica del filtro
 * (mismo criterio documentado en §E): una cuenta esperando el 3DS de la
 * clienta YA tiene `providerSubscriptionId` (lo persiste el endpoint de alta
 * antes de devolver el `clientSecret`), así que este barrendero jamás la
 * toca — solo libera cuentas donde Stripe nunca llegó a confirmar nada.
 */
async function expireIncompleteSubscriptions(
  now: Date = new Date(),
  thresholdMinutes: number,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<ExpireIncompleteSubscriptionsSummary> {
  const threshold = new Date(now.getTime() - thresholdMinutes * 60_000);
  const stale = await SubscriptionAccount.find({
    status: SubscriptionStatus.INCOMPLETE,
    providerSubscriptionId: { $exists: false },
    seatHeldAt: { $lt: threshold },
  })
    .select("_id")
    .limit(batchSize)
    .lean();

  let expired = 0;
  let failed = 0;

  for (const { _id } of stale) {
    try {
      // Relectura fresca (nunca el documento `lean()` de arriba): entre el
      // `find` y este punto, un webhook pudo adoptar la cuenta por su
      // `accountIdHint` (`locateAccountForEvent`) o el endpoint de alta pudo
      // persistir sus refs — `applyStatusTransition` trae su propio CAS,
      // pero re-verificar aquí evita lanzar (y contar como `failed`) por una
      // carrera legítima que ya resolvió el estado por su cuenta.
      const account = await SubscriptionAccount.findById(_id);
      if (!account) continue;
      if (account.status !== SubscriptionStatus.INCOMPLETE || account.providerSubscriptionId) continue;

      await applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");
      await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_INCOMPLETE_EXPIRED, targetId: _id });
      expired += 1;
    } catch (error) {
      // El CAS de `applyStatusTransition` (409) puede perderse frente a un
      // escritor concurrente LEGÍTIMO (un webhook tardío que cancela o
      // adopta la cuenta justo entre la relectura de arriba y este punto) —
      // no es una falla real del barrendero, es la misma carrera que
      // `applySystemStatus` tolera con `noop`. Solo se cuenta `failed` (y se
      // loguea como error) cuando la cuenta SIGUE matcheando el criterio de
      // expiración después de releer — ahí sí es una falla genuina.
      if (error instanceof AppError && error.statusCode === 409) {
        // Propia guarda: un rechazo aquí (p. ej. un error transitorio de
        // Atlas) NO debe abortar el resto del lote — mismo criterio de
        // aislamiento por ítem que el resto de esta función.
        try {
          const reloaded = await SubscriptionAccount.findById(_id);
          const stillMatches =
            reloaded?.status === SubscriptionStatus.INCOMPLETE && !reloaded.providerSubscriptionId;
          if (!stillMatches) continue;
        } catch (reloadError) {
          failed += 1;
          logger.error(
            { err: reloadError, accountId: _id.toString() },
            "Fallo al releer una cuenta tras un 409 al expirar suscripciones incompletas",
          );
          continue;
        }
      }
      failed += 1;
      logger.error({ err: error, accountId: _id.toString() }, "Fallo al expirar una suscripción incompleta");
    }
  }

  return { scanned: stale.length, expired, failed };
}

export { expireIncompleteSubscriptions };
export type { ExpireIncompleteSubscriptionsSummary };
