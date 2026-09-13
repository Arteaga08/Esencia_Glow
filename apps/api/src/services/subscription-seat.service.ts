import { Types, type ClientSession } from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";
import {
  SubscriptionAccount,
  MAX_SUBSCRIPTION_STATUS_HISTORY,
  type SubscriptionAccountDocument,
} from "../models/subscription-account.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import type { SubscriptionStatusHistoryEntryAttrs } from "../models/subscription-status-history.schema.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { assertTransition, seatEffect, type SubscriptionActor } from "./subscription-state.js";

/**
 * Cupo de un plan (decisión 2 del plan de 1.7.1): `seatsTaken` decide en el
 * MISMO `findOneAndUpdate` que lo incrementa — nunca un `countDocuments`
 * previo, que es irremediablemente read-then-write (dos altas concurrentes
 * insertan documentos DISTINTOS, así que ni `readConcern: snapshot` evita
 * que ambas lean `N-1` y ambas ganen). El precedente correcto es
 * `Inventory.onHand/reserved`, no `Bundle.stockCache` (que es una caché de
 * display que nunca decide una venta) — el cupo es un inventario de plazas.
 */

interface StartSubscriptionInput {
  userId: string;
  planId: string;
}

/** Reclama un lugar en el plan, atómico. Lanza 409 si el plan está inactivo,
 * no existe, o ya llegó a `maxActiveSeats` — antes de tocar Stripe (1.7.2). */
async function claimSeat(planId: string, session: ClientSession): Promise<void> {
  const claimed = await SubscriptionPlan.findOneAndUpdate(
    { _id: planId, isActive: true, $expr: { $lt: ["$seatsTaken", "$maxActiveSeats"] } },
    { $inc: { seatsTaken: 1 } },
    { new: true, session },
  );
  if (!claimed) {
    throw new AppError("Este plan está agotado por ahora.", 409);
  }
}

/** Libera un lugar. `$expr: {$gt: [..., 0]}` es una guarda defensiva (nunca
 * debería dispararse si `seatEffect` se aplicó una sola vez por transición):
 * un `$inc` sin condición podría dejar `seatsTaken` negativo, igual que
 * `onHand` bajo un `$inc` sin `$expr` (ver inventory.model.ts). */
async function releaseSeat(planId: string, session: ClientSession): Promise<void> {
  await SubscriptionPlan.updateOne(
    { _id: planId, $expr: { $gt: ["$seatsTaken", 0] } },
    { $inc: { seatsTaken: -1 } },
    { session },
  );
}

function toActorType(actor: SubscriptionActor): "user" | "system" {
  return actor === "system" ? "system" : "user";
}

/**
 * Alta (o re-alta) de una suscripción — el punto de entrada que 1.7.2 conecta
 * al endpoint de la clienta. NO pasa por `assertTransition`: una alta nueva
 * es una creación, no una transición (mismo criterio que `createOrderCore`,
 * que tampoco pasa por `order-state.ts` para el `status: PENDING` inicial).
 *
 * Lee primero (`findOne` DENTRO de la transacción, mismo snapshot) para
 * decidir la rama, en vez de "crear y atrapar el E11000": un error de
 * escritura dentro de una transacción de Mongo la aborta del lado del
 * SERVIDOR de inmediato, aunque el cliente atrape la excepción en JS —
 * seguir escribiendo en esa misma transacción (como haría un `create` + catch
 * + `findOneAndUpdate`) siempre falla con `NoSuchTransaction`, y
 * `withTransaction` la reintentaría para siempre porque `NoSuchTransaction`
 * trae la etiqueta `TransientTransactionError` (ver el aviso explícito en la
 * documentación del driver de `ClientSession.withTransaction`). Leer primero
 * evita pisar ese error de escritura por completo.
 *
 * Reusa el documento existente si estaba `CANCELED` (decisión de diseño:
 * un `SubscriptionAccount` por usuaria para siempre — ver el modelo).
 * Cualquier otro estado existente (INCOMPLETE/ACTIVE/PAST_DUE/PAUSED) es un
 * 409: ya tiene una suscripción viva. El `throw` en ese caso aborta TODA la
 * transacción, incluido el cupo reclamado arriba — sin necesitar una
 * escritura compensatoria.
 *
 * Dos altas simultáneas de la MISMA usuaria (ninguna tiene cuenta previa)
 * siguen resolviéndose en el motor: si ambas transacciones intentan
 * `create()` con el mismo `userId` a la vez, WiredTiger aborta a la
 * perdedora con un WriteConflict real (`TransientTransactionError`
 * genuino) — `withTransaction` reintenta ESA transacción desde cero, y en
 * el reintento el `findOne` ya ve el documento ganador committeado.
 */
async function startSubscription(
  input: StartSubscriptionInput,
  session?: ClientSession,
): Promise<SubscriptionAccountDocument> {
  return withTransaction(async (s) => {
    await claimSeat(input.planId, s);

    const now = new Date();
    const historyEntry: SubscriptionStatusHistoryEntryAttrs = {
      status: SubscriptionStatus.INCOMPLETE,
      at: now,
      actorType: "user",
    };

    const existing = await SubscriptionAccount.findOne({ userId: input.userId }).session(s);

    if (!existing) {
      const [account] = await SubscriptionAccount.create(
        [
          {
            userId: new Types.ObjectId(input.userId),
            planId: new Types.ObjectId(input.planId),
            status: SubscriptionStatus.INCOMPLETE,
            seatHeldAt: now,
            cancelAtPeriodEnd: false,
            statusHistory: [historyEntry],
          },
        ],
        { session: s },
      );
      return account as SubscriptionAccountDocument;
    }

    if (existing.status !== SubscriptionStatus.CANCELED) {
      throw new AppError("Ya tienes una suscripción, cancélala antes de crear otra.", 409);
    }

    const reactivated = await SubscriptionAccount.findOneAndUpdate(
      { _id: existing._id, status: SubscriptionStatus.CANCELED },
      {
        $set: {
          status: SubscriptionStatus.INCOMPLETE,
          planId: input.planId,
          seatHeldAt: now,
          cancelAtPeriodEnd: false,
        },
        $unset: { canceledAt: 1, cancelRequestedAt: 1, cancelReason: 1 },
        $push: { statusHistory: { $each: [historyEntry], $slice: -MAX_SUBSCRIPTION_STATUS_HISTORY } },
      },
      { new: true, session: s },
    );
    // No puede ser null: `existing` se leyó en ESTE mismo snapshot con
    // status CANCELED, y ningún otro escritor puede haberlo cambiado sin
    // provocar un WriteConflict que hubiera abortado y reintentado esta
    // transacción completa antes de llegar aquí.
    return reactivated!;
  }, session);
}

/**
 * Único punto de entrada para mover el estado de una cuenta YA existente
 * (pausar, reanudar, cancelar, pasar a `past_due`…). Valida la transición,
 * aplica el efecto de cupo que le corresponda y persiste todo en la misma
 * transacción — un `claimSeat` que falla (plan lleno al reanudar) aborta
 * antes de tocar el documento de la cuenta, que queda exactamente como
 * estaba.
 *
 * El CAS `{_id, status: account.status}` en el `findOneAndUpdate` es la
 * misma defensa que `markOrderPaidCore`: si otra llamada ya movió esta
 * cuenta desde que se leyó `account`, esta pierde la carrera con un 409
 * explícito en vez de pisar un estado que ya no es el que creía.
 */
async function applyStatusTransition(
  account: SubscriptionAccountDocument,
  to: SubscriptionStatus,
  actor: SubscriptionActor,
  session?: ClientSession,
): Promise<SubscriptionAccountDocument> {
  assertTransition(account.status, to, actor);
  const effect = seatEffect(account.status, to);

  return withTransaction(async (s) => {
    if (effect === "hold") await claimSeat(account.planId.toString(), s);
    if (effect === "release") await releaseSeat(account.planId.toString(), s);

    const now = new Date();
    const historyEntry: SubscriptionStatusHistoryEntryAttrs = { status: to, at: now, actorType: toActorType(actor) };

    const update: Record<string, unknown> = {
      $set: { status: to },
      $push: { statusHistory: { $each: [historyEntry], $slice: -MAX_SUBSCRIPTION_STATUS_HISTORY } },
    };
    if (effect === "hold") (update.$set as Record<string, unknown>).seatHeldAt = now;
    if (effect === "release") update.$unset = { seatHeldAt: 1 };

    const updated = await SubscriptionAccount.findOneAndUpdate(
      { _id: account._id, status: account.status },
      update,
      { new: true, session: s },
    );
    if (!updated) {
      throw new AppError("La suscripción cambió de estado, vuelve a intentarlo.", 409);
    }
    return updated;
  }, session);
}

export { claimSeat, releaseSeat, startSubscription, applyStatusTransition };
export type { StartSubscriptionInput };
