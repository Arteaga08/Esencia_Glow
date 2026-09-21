import type { Types } from "mongoose";
import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { recordAudit } from "./audit.service.js";
import { compensate, loadOwnAccount, requireProviderRef } from "./subscription-account-access.js";
import { resolveSubscriptionProvider } from "./subscription-provider.js";
import { claimSeat, releaseSeat } from "./subscription-seat.service.js";
import { SEAT_HOLDING_STATUSES } from "./subscription-state.js";

/**
 * Cambio de plan inmediato y sin prorrateo (Milestone 1.7.3): el cupo se
 * mueve al instante (409 si el plan nuevo está lleno), la caja del ciclo ya
 * pagado no cambia y el siguiente cobro anclado ya usa el precio nuevo.
 *
 * Protocolo (los dos cupos y Stripe no caben en una sola transacción):
 *   1. Una transacción reclama el cupo del plan NUEVO —sin soltar el viejo— y
 *      deja el marcador `pendingPlanChange`. Por unos instantes la cuenta
 *      ocupa DOS cupos: puede mostrar un "agotado" falso, nunca sobrevender.
 *   2. Se llama a Stripe con una clave de idempotencia derivada del marcador.
 *   3. `finalizePlanChange` confirma (plan nuevo, suelta el viejo); si Stripe
 *      falló, `abortPlanChange` deshace (suelta el nuevo).
 *
 * Por qué el marcador y no "mover todo local y luego Stripe": la compensación
 * de eso sería VOLVER a reclamar el cupo viejo, que puede dar 409 si alguien
 * lo tomó entre medias. Aquí toda compensación solo SUELTA un cupo, que
 * siempre funciona.
 *
 * Regla de propiedad: quien borra el marcador es DUEÑO de soltar el cupo que
 * corresponda (finalizar, abortar y la re-alta de `startSubscription`). Todos
 * lo borran con un CAS sobre `requestedAt`, así que solo uno lo consume y
 * ninguno puede soltar dos veces ni filtrar uno. Si el proceso muere entre los
 * pasos 1 y 3, o Stripe da un error AMBIGUO (timeout: pudo haberse aplicado), el
 * marcador se conserva y el job `reconcile-pending-plan-changes` —que pregunta a
 * Stripe el precio real— llama a estas mismas funciones. Es el único camino de
 * recuperación: un `.updated` no trae orden, no sirve de evidencia.
 *
 * El controller ya verificó `resolveSubscriptionProvider()` (503) — de ahí el `!`.
 */

type PlanChangeOutcome = "finalized" | "aborted" | "noop";

function assertCanChangePlan(account: Awaited<ReturnType<typeof loadOwnAccount>>): void {
  if (account.status === SubscriptionStatus.PAST_DUE) {
    throw new AppError("Regulariza tu pago antes de cambiar de plan.", 409);
  }
  if (account.status !== SubscriptionStatus.ACTIVE) {
    throw new AppError("Solo puedes cambiar de plan con una suscripción activa.", 409);
  }
  if (account.cancelAtPeriodEnd) {
    throw new AppError("Tu suscripción está programada para cancelarse, deshaz la cancelación antes de cambiar de plan.", 409);
  }
  if (account.pendingPlanChange) {
    throw new AppError("Ya tienes un cambio de plan en curso, inténtalo de nuevo en unos minutos.", 409);
  }
}

async function changePlan(userId: string, newPlanId: string): Promise<void> {
  const provider = resolveSubscriptionProvider()!;
  const account = await loadOwnAccount(userId);
  assertCanChangePlan(account);
  const subscriptionRef = requireProviderRef(account);
  const oldPlanId = account.planId.toString();

  if (newPlanId === oldPlanId) {
    throw new AppError("Ya estás en ese plan.", 409);
  }

  const [currentPlan, newPlan] = await Promise.all([
    SubscriptionPlan.findById(account.planId).select("currency").lean(),
    SubscriptionPlan.findById(newPlanId).select("isActive providerPriceId currency").lean(),
  ]);
  if (!newPlan || !newPlan.isActive || !newPlan.providerPriceId) {
    throw new AppError("Ese plan no está disponible.", 409);
  }
  if (currentPlan && currentPlan.currency !== newPlan.currency) {
    throw new AppError("No puedes cambiar a un plan con otra moneda.", 409);
  }

  const requestedAt = new Date();
  await withTransaction(async (s) => {
    await claimSeat(newPlanId, s);

    const marked = await SubscriptionAccount.updateOne(
      {
        _id: account._id,
        status: SubscriptionStatus.ACTIVE,
        planId: account.planId,
        cancelAtPeriodEnd: false,
        pendingPlanChange: { $exists: false },
      },
      { $set: { pendingPlanChange: { planId: newPlanId, requestedAt } } },
      { session: s },
    );
    // El `throw` aborta TODA la transacción, incluido el cupo reclamado arriba.
    if (marked.matchedCount === 0) {
      throw new AppError("La suscripción cambió, vuelve a intentarlo.", 409);
    }
  });

  try {
    await provider.changePrice({
      subscriptionRef,
      priceRef: newPlan.providerPriceId,
      metadata: { planId: newPlanId },
      idempotencyKey: `account:${account._id.toString()}:plan:${requestedAt.getTime()}`,
    });
  } catch (error) {
    // Solo un rechazo DEFINITIVO (409: Stripe respondió que no aplica) aborta.
    // Cualquier otro error (502: timeout, red, API caída) es AMBIGUO — Stripe
    // pudo haber aplicado el precio antes de que se perdiera la respuesta.
    // Abortar entonces soltaría el cupo nuevo mientras Stripe ya cobra el
    // precio nuevo, y ni el reconciliador ni nada podrían repararlo (ambos
    // necesitan el marcador). Se conserva el marcador: el reconciliador
    // pregunta a Stripe el precio real y finaliza o aborta con evidencia.
    if (error instanceof AppError && error.statusCode === 409) {
      await compensate(account._id, "change_plan", () => abortPlanChange(account._id, requestedAt));
    }
    throw error;
  }

  await finalizePlanChange(account._id, requestedAt);
  await recordAudit({
    action: SubscriptionAction.SUBSCRIPTION_PLAN_CHANGED,
    actorId: userId,
    targetId: account._id,
    metadata: { from: oldPlanId, to: newPlanId },
  });
}

/**
 * Confirma el cambio: la cuenta pasa al plan nuevo y suelta el cupo del viejo.
 * Si un webhook la canceló a media operación, la cancelación ya soltó el cupo
 * VIEJO (`applyStatusTransition` libera contra `planId`), así que solo queda
 * soltar el nuevo. Idempotente y segura en carrera: el CAS sobre `requestedAt`
 * hace que exactamente un llamador consuma el marcador.
 */
async function finalizePlanChange(
  accountId: Types.ObjectId | string,
  requestedAt: Date,
): Promise<Extract<PlanChangeOutcome, "finalized" | "noop">> {
  return withTransaction(async (s) => {
    const account = await SubscriptionAccount.findOne({
      _id: accountId,
      "pendingPlanChange.requestedAt": requestedAt,
    }).session(s);
    const pending = account?.pendingPlanChange;
    if (!account || !pending) return "noop";

    const holdsSeat = SEAT_HOLDING_STATUSES.includes(account.status);
    const updated = await SubscriptionAccount.findOneAndUpdate(
      { _id: account._id, status: account.status, "pendingPlanChange.requestedAt": requestedAt },
      holdsSeat ? { $set: { planId: pending.planId }, $unset: { pendingPlanChange: 1 } } : { $unset: { pendingPlanChange: 1 } },
      { session: s },
    );
    if (!updated) return "noop";

    await releaseSeat((holdsSeat ? account.planId : pending.planId).toString(), s);
    return "finalized";
  });
}

/** Deshace el cambio: suelta el cupo nuevo y borra el marcador; el plan no
 * cambia. Mismo CAS que `finalizePlanChange`, así que ambos en carrera nunca
 * suman más de un cupo. */
async function abortPlanChange(
  accountId: Types.ObjectId | string,
  requestedAt: Date,
): Promise<Extract<PlanChangeOutcome, "aborted" | "noop">> {
  return withTransaction(async (s) => {
    const previous = await SubscriptionAccount.findOneAndUpdate(
      { _id: accountId, "pendingPlanChange.requestedAt": requestedAt },
      { $unset: { pendingPlanChange: 1 } },
      { session: s, new: false },
    );
    if (!previous?.pendingPlanChange) return "noop";

    await releaseSeat(previous.pendingPlanChange.planId.toString(), s);
    return "aborted";
  });
}

export { changePlan, finalizePlanChange, abortPlanChange };
export type { PlanChangeOutcome };
