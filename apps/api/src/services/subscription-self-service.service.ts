import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { logger } from "../config/logger.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";
import { compensate, loadOwnAccount, requireProviderRef } from "./subscription-account-access.js";
import { updatePeriodIfNewer } from "./subscription-billing.service.js";
import {
  resolveSubscriptionProvider,
  type ProviderSubscription,
  type SubscriptionProvider,
} from "./subscription-provider.js";
import { applyStatusTransition } from "./subscription-seat.service.js";
import { CANCEL_SCHEDULABLE_STATUSES, canUndoCancel } from "./subscription-state.js";

/**
 * Autoservicio de la suscriptora (Milestone 1.7.3): pausar, reanudar,
 * cancelar y deshacer la cancelación. El cambio de plan y la tarjeta viven en
 * sus propios archivos (`subscription-plan-change.service.ts`,
 * `subscription-payment-method.service.ts`).
 *
 * Regla de orden de TODO este archivo: el paso que puede fallar sin poder
 * deshacerse (reclamar cupo) va primero; cuando el paso sin deshacer es el de
 * Stripe (pausar, cancelar), Stripe va primero. Toda compensación es un paso
 * que siempre funciona — soltar un cupo, reenviar a Stripe un valor
 * idempotente — nunca uno que pueda fallar por una carrera ajena (como
 * "volver a reclamar el cupo").
 *
 * El controller ya verificó `resolveSubscriptionProvider()` antes de llamar
 * aquí (mismo criterio que `startSubscriptionForUser`): el 503 se decide
 * antes de tocar cupo o estado — de ahí el `!` sobre el resultado.
 *
 * `applyStatusTransition` es el único escritor de `status`: aquí solo se
 * escriben directo los campos que NO son estado (`cancelAtPeriodEnd` y su
 * motivo), con un CAS sobre el estado esperado.
 */

/** No se puede pausar a menos de 48 h del siguiente cobro: Stripe no
 * garantiza detener una factura que ya se generó o finalizó justo antes del
 * ancla, y un cobro sobre una cuenta pausada es una caja no enviada (el
 * webhook lo rechaza como `paused_account_charged`). */
const PAUSE_CUTOFF_MS = 48 * 60 * 60 * 1000;

type CancelOutcome = "scheduled" | "canceled";

/** ACTIVE + sin cancelación programada + sin cambio de plan en curso + a más
 * de 48 h del siguiente cobro. */
function assertCanPause(account: SubscriptionAccountDocument, now: Date): void {
  if (account.status === SubscriptionStatus.PAST_DUE) {
    throw new AppError("Regulariza tu pago antes de pausar tu suscripción.", 409);
  }
  if (account.status !== SubscriptionStatus.ACTIVE) {
    throw new AppError("Solo puedes pausar una suscripción activa.", 409);
  }
  if (account.cancelAtPeriodEnd) {
    throw new AppError("Tu suscripción está programada para cancelarse, deshaz la cancelación antes de pausar.", 409);
  }
  if (account.pendingPlanChange) {
    throw new AppError("Tienes un cambio de plan en curso, inténtalo de nuevo en unos minutos.", 409);
  }
  if (account.currentPeriodEnd && account.currentPeriodEnd.getTime() - now.getTime() < PAUSE_CUTOFF_MS) {
    throw new AppError("No puedes pausar en las 48 horas previas a tu siguiente cobro.", 409);
  }
}

/**
 * Stripe primero, local después: el paso local suelta el cupo (`ACTIVE ->
 * PAUSED`) y "deshacerlo" implicaría volver a reclamarlo — que puede dar
 * 409 si alguien lo tomó entre medias. Si la escritura local falla,
 * `resumeCollection` sí siempre funciona.
 */
async function pauseSubscription(userId: string): Promise<void> {
  const provider = resolveSubscriptionProvider()!;
  const account = await loadOwnAccount(userId);
  assertCanPause(account, new Date());
  const subscriptionRef = requireProviderRef(account);

  await provider.pauseCollection({ subscriptionRef });

  try {
    await applyStatusTransition(account, SubscriptionStatus.PAUSED, "customer", undefined, {
      set: { pausedAt: new Date() },
      guard: { cancelAtPeriodEnd: false, pendingPlanChange: { $exists: false } },
    });
  } catch (error) {
    await compensate(account._id, "pause", () => provider.resumeCollection({ subscriptionRef }));
    throw error;
  }

  await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_PAUSED, actorId: userId, targetId: account._id });
}

type ResumeVerification = { subscription: ProviderSubscription } | "still_paused" | "unknown";

/** ¿Stripe quedó reanudado pese al error? `still_paused` cubre también una
 * suscripción ya cancelada allá (no hay nada que reanudar: vuelve a `PAUSED` y
 * el `.deleted` la converge). `unknown` = no se pudo consultar. */
async function verifyResumed(provider: SubscriptionProvider, subscriptionRef: string): Promise<ResumeVerification> {
  try {
    const subscription = await provider.getSubscription(subscriptionRef);
    return subscription.status === "canceled" || subscription.collectionPaused
      ? "still_paused"
      : { subscription };
  } catch {
    return "unknown";
  }
}

/**
 * Local primero, Stripe después: reclamar el cupo es el paso que puede
 * fallar sin remedio (plan lleno -> 409), así que corre antes de tocar a
 * Stripe. Si Stripe falla, la compensación vuelve a `PAUSED`, que solo
 * SUELTA el cupo — siempre funciona.
 */
async function resumeSubscription(userId: string): Promise<void> {
  const provider = resolveSubscriptionProvider()!;
  const account = await loadOwnAccount(userId);
  if (account.status !== SubscriptionStatus.PAUSED) {
    throw new AppError("Tu suscripción no está pausada.", 409);
  }
  const subscriptionRef = requireProviderRef(account);
  const originalPausedAt = account.pausedAt ?? new Date();

  const resumed = await applyStatusTransition(account, SubscriptionStatus.ACTIVE, "customer", undefined, {
    unset: ["pausedAt"],
  });

  let providerSubscription: ProviderSubscription;
  try {
    providerSubscription = await provider.resumeCollection({ subscriptionRef });
  } catch (error) {
    // Un error de `resumeCollection` puede ser AMBIGUO (timeout/red después de
    // que Stripe SÍ reanudó). Volver a `PAUSED` a ciegas dejaría a la clienta
    // cobrada por Stripe con una cuenta local pausada: el `invoice.paid` se
    // rechazaría como `paused_account_charged` y pagaría sin caja. Se pregunta
    // a Stripe el estado REAL antes de decidir.
    const verified = await verifyResumed(provider, subscriptionRef);
    if (typeof verified === "object") {
      providerSubscription = verified.subscription;
    } else {
      if (verified === "unknown") {
        // Sin evidencia, lo menos dañino es quedarse `ACTIVE`: peor sería
        // cobrar sin generar caja. La divergencia se audita para reconciliar.
        await recordAudit({
          action: SubscriptionAction.SUBSCRIPTION_PROVIDER_MISMATCH,
          targetId: account._id,
          metadata: { operation: "resume", reason: "provider_state_unknown" },
        });
      } else {
        await compensate(account._id, "resume", () =>
          applyStatusTransition(resumed, SubscriptionStatus.PAUSED, "customer", undefined, {
            set: { pausedAt: originalPausedAt },
          }),
        );
      }
      throw error;
    }
  }

  // Mientras estuvo pausada, Stripe siguió avanzando el período (las facturas
  // se anulan) y los `.updated` se ignoraron: el que tenemos está viejo.
  if (providerSubscription.currentPeriodStart && providerSubscription.currentPeriodEnd) {
    await updatePeriodIfNewer(
      account._id,
      providerSubscription.currentPeriodStart,
      providerSubscription.currentPeriodEnd,
    );
  }

  await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_RESUMED, actorId: userId, targetId: account._id });
}

/** Tras perder el CAS: ¿ya quedó el efecto deseado por otro request
 * concurrente idéntico? Si sí, es éxito, NO una carrera perdida — y
 * compensar en Stripe desharía lo que el ganador acaba de dejar puesto. */
async function hasCancelFlag(accountId: SubscriptionAccountDocument["_id"], expected: boolean): Promise<boolean> {
  const current = await SubscriptionAccount.findOne({
    _id: accountId,
    status: { $in: CANCEL_SCHEDULABLE_STATUSES },
    cancelAtPeriodEnd: expected,
  })
    .select("_id")
    .lean();
  return current !== null;
}

/** `ACTIVE`/`PAST_DUE`: la clienta nunca cancela directo, solo marca
 * `cancelAtPeriodEnd` — quien transiciona a `CANCELED` es el webhook al
 * cerrar el período pagado. */
async function scheduleCancellation(
  account: SubscriptionAccountDocument,
  userId: string,
  reason: string | undefined,
): Promise<CancelOutcome> {
  const provider = resolveSubscriptionProvider()!;
  if (account.pendingPlanChange) {
    throw new AppError("Tienes un cambio de plan en curso, inténtalo de nuevo en unos minutos.", 409);
  }
  const subscriptionRef = requireProviderRef(account);

  // Ya programada: se reenvía a Stripe (repara una divergencia) pero no se
  // vuelve a escribir ni a auditar, y el motivo original se conserva.
  if (account.cancelAtPeriodEnd) {
    await provider.setCancelAtPeriodEnd({ subscriptionRef, cancelAtPeriodEnd: true });
    return "scheduled";
  }

  await provider.setCancelAtPeriodEnd({
    subscriptionRef,
    cancelAtPeriodEnd: true,
    ...(reason ? { comment: reason } : {}),
  });

  const updated = await SubscriptionAccount.findOneAndUpdate(
    {
      _id: account._id,
      status: { $in: CANCEL_SCHEDULABLE_STATUSES },
      cancelAtPeriodEnd: false,
      pendingPlanChange: { $exists: false },
    },
    { $set: { cancelAtPeriodEnd: true, cancelRequestedAt: new Date(), ...(reason ? { cancelReason: reason } : {}) } },
    { new: true },
  );

  if (!updated) {
    if (await hasCancelFlag(account._id, true)) return "scheduled";
    await compensate(account._id, "cancel", () =>
      provider.setCancelAtPeriodEnd({ subscriptionRef, cancelAtPeriodEnd: false }),
    );
    throw new AppError("La suscripción cambió de estado, vuelve a intentarlo.", 409);
  }

  await recordAudit({
    action: SubscriptionAction.SUBSCRIPTION_CANCEL_SCHEDULED,
    actorId: userId,
    targetId: account._id,
  });
  return "scheduled";
}

/**
 * `PAUSED`: no hay ciclo pagado que respetar (nada se cobra mientras está
 * pausada), así que se cancela de inmediato. Cancelar en Stripe es FINAL —
 * no hay "des-cancelar" con qué compensar: si la escritura local falla, el
 * webhook `.deleted` converge (la máquina admite `system` en `PAUSED ->
 * CANCELED`), y aquí solo se relee por si ya lo hizo.
 */
async function cancelPaused(
  account: SubscriptionAccountDocument,
  userId: string,
  reason: string | undefined,
): Promise<CancelOutcome> {
  const provider = resolveSubscriptionProvider()!;
  const subscriptionRef = requireProviderRef(account);
  const anchor = (account.pausedAt ?? account.updatedAt ?? new Date(0)).getTime();

  await provider.cancelNow({
    subscriptionRef,
    ...(reason ? { comment: reason } : {}),
    idempotencyKey: `account:${account._id.toString()}:cancel:${anchor}`,
  });

  try {
    await applyStatusTransition(account, SubscriptionStatus.CANCELED, "customer", undefined, {
      set: { canceledAt: new Date(), cancelAtPeriodEnd: false, ...(reason ? { cancelReason: reason } : {}) },
      unset: ["pausedAt"],
    });
  } catch (error) {
    const current = await SubscriptionAccount.findById(account._id).select("status").lean();
    if (current?.status === SubscriptionStatus.CANCELED) return "canceled";
    logger.error(
      { err: error, accountId: account._id.toString() },
      "Stripe canceló la suscripción pausada pero la escritura local falló",
    );
    throw error;
  }

  await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_CANCELED, actorId: userId, targetId: account._id });
  return "canceled";
}

/** El service decide por estado (no hay ruta separada para cancelar una
 * pausada): una pausada no tiene derechos de suscriptora, así que este
 * endpoint no lleva `requireCapability`. */
async function cancelSubscription(userId: string, reason?: string): Promise<CancelOutcome> {
  const account = await loadOwnAccount(userId);

  if (account.status === SubscriptionStatus.PAUSED) {
    return cancelPaused(account, userId, reason);
  }
  if (CANCEL_SCHEDULABLE_STATUSES.includes(account.status)) {
    return scheduleCancellation(account, userId, reason);
  }
  throw new AppError("Tu suscripción no se puede cancelar en este momento.", 409);
}

/** Espejo de `scheduleCancellation`. Solo mientras el período pagado siga
 * vigente: después ya lo cerró el webhook. */
async function undoCancelSubscription(userId: string): Promise<void> {
  const provider = resolveSubscriptionProvider()!;
  const account = await loadOwnAccount(userId);

  if (!CANCEL_SCHEDULABLE_STATUSES.includes(account.status) || !account.cancelAtPeriodEnd) {
    throw new AppError("No tienes una cancelación pendiente que deshacer.", 409);
  }
  if (!canUndoCancel(account)) {
    // Lo único que queda por revisar es el período: ya venció.
    throw new AppError("Tu suscripción ya terminó.", 409);
  }
  const subscriptionRef = requireProviderRef(account);

  try {
    await provider.setCancelAtPeriodEnd({ subscriptionRef, cancelAtPeriodEnd: false });
  } catch (error) {
    // Stripe rechaza el cambio (409 del adapter) cuando la suscripción ya
    // terminó justo en esta ventana.
    if (error instanceof AppError && error.statusCode === 409) {
      throw new AppError("Tu suscripción ya terminó.", 409);
    }
    throw error;
  }

  const updated = await SubscriptionAccount.findOneAndUpdate(
    { _id: account._id, status: { $in: CANCEL_SCHEDULABLE_STATUSES }, cancelAtPeriodEnd: true },
    { $set: { cancelAtPeriodEnd: false }, $unset: { cancelRequestedAt: 1, cancelReason: 1 } },
    { new: true },
  );

  if (!updated) {
    if (await hasCancelFlag(account._id, false)) return;
    await compensate(account._id, "undo_cancel", () =>
      provider.setCancelAtPeriodEnd({ subscriptionRef, cancelAtPeriodEnd: true }),
    );
    throw new AppError("La suscripción cambió de estado, vuelve a intentarlo.", 409);
  }

  await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_CANCEL_UNDONE, actorId: userId, targetId: account._id });
}

export { pauseSubscription, resumeSubscription, cancelSubscription, undoCancelSubscription };
export type { CancelOutcome };
