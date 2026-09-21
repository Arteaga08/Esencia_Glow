import type { Types } from "mongoose";
import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { applyStatusTransition } from "./subscription-seat.service.js";
import { canActorTransition } from "./subscription-state.js";
import { recordAudit } from "./audit.service.js";

/**
 * Escrituras de estado/período/dunning que el webhook de Billing necesita
 * (Fase 3 de 1.7.2a, §D del plan) — separado de `subscription-seat.service.ts`
 * a propósito: ese archivo es el guardián de una invariante dura (status +
 * cupo + historial con CAS) y su valor viene de tener exactamente un
 * trabajo. Este archivo COMPONE sobre él, nunca lo extiende.
 */

interface ApplySystemStatusFields {
  canceledAt?: Date;
  cancelReason?: string;
  cancelAtPeriodEnd?: boolean;
}

type ApplySystemStatusResult =
  | { outcome: "applied"; account: SubscriptionAccountDocument }
  | { outcome: "noop"; account: SubscriptionAccountDocument };

/** Solo las transiciones donde vale la pena un rastro propio en el trail —
 * `ACTIVE` (primera activación o reactivación tras dunning) la audita el
 * HANDLER como `SUBSCRIPTION_RENEWED`, condicionado a si la caja del ciclo
 * salió `created` — esta función no sabe nada de cajas. */
const STATUS_AUDIT_ACTION: Partial<Record<SubscriptionStatus, SubscriptionAction>> = {
  [SubscriptionStatus.PAST_DUE]: SubscriptionAction.SUBSCRIPTION_PAST_DUE,
  [SubscriptionStatus.CANCELED]: SubscriptionAction.SUBSCRIPTION_CANCELED,
};

function isConflict409(error: unknown): error is AppError {
  return error instanceof AppError && error.statusCode === 409;
}

/**
 * Mueve el estado de una cuenta por una decisión de `system` (webhook),
 * SIN lanzar para ninguna carrera legítima:
 *
 * - Ya está en `to`: `noop` (dos eventos que confirman lo mismo, p. ej.
 *   `invoice.paid` y `customer.subscription.updated(active)` compitiendo).
 * - `to` no es alcanzable por `system` desde el estado actual: `noop` — el
 *   pre-chequeo con `canActorTransition` evita el 409 que lanzaría
 *   `assertTransition` (p. ej. `ACTIVE -> PAUSED` no es de `system`).
 * - CAS perdido (otro evento movió la cuenta ENTRE que se leyó `account` y
 *   que esta llamada intentó escribir): se relee y se resuelve con el
 *   documento fresco — nunca se propaga el 409 de
 *   `subscription-seat.service.ts::applyStatusTransition`. Ninguna
 *   transición de `system` tiene efecto de cupo `hold`, así que
 *   `applyStatusTransition` solo puede fallar aquí por el CAS, nunca por
 *   `claimSeat`.
 *
 * `fields` (campos hermanos como `canceledAt`/`cancelReason`) se escriben en
 * la MISMA transacción que la transición, nunca en un `save()` aparte.
 */
/** Tope del reintento por CAS perdido — 3 escritores de `system` chocando
 * sobre la MISMA cuenta en la misma ventana de milisegundos es un patrón
 * imposible en el diseño actual (ningún caller concurrente aplica más de un
 * evento por invocación); si ocurriera, es señal de que algo más está mal, y
 * se prefiere un 409 explícito a reintentar sin límite (code review de esta
 * fase). */
const MAX_STATUS_RETRY_ATTEMPTS = 3;

async function applySystemStatus(
  account: SubscriptionAccountDocument,
  to: SubscriptionStatus,
  fields: ApplySystemStatusFields = {},
  attempt = 1,
): Promise<ApplySystemStatusResult> {
  if (account.status === to) {
    return { outcome: "noop", account };
  }
  if (!canActorTransition(account.status, to, "system")) {
    return { outcome: "noop", account };
  }

  try {
    const updated = await withTransaction(async (session) => {
      const transitioned = await applyStatusTransition(account, to, "system", session);
      if (Object.keys(fields).length === 0) return transitioned;

      const withFields = await SubscriptionAccount.findByIdAndUpdate(
        transitioned._id,
        { $set: fields },
        { new: true, session },
      );
      return withFields as SubscriptionAccountDocument;
    });

    const auditAction = STATUS_AUDIT_ACTION[to];
    if (auditAction) {
      await recordAudit({ action: auditAction, targetId: updated._id });
    }
    return { outcome: "applied", account: updated };
  } catch (error) {
    if (!isConflict409(error)) throw error;

    const refreshed = await SubscriptionAccount.findById(account._id);
    if (!refreshed) throw error;
    if (refreshed.status === to) return { outcome: "noop", account: refreshed };
    if (!canActorTransition(refreshed.status, to, "system")) return { outcome: "noop", account: refreshed };

    if (attempt >= MAX_STATUS_RETRY_ATTEMPTS) {
      throw error;
    }
    // Reintento con el documento fresco (§D del plan): las transiciones de
    // `system` nunca reclaman cupo, así que perder el CAS otra vez requiere
    // OTRO escritor concurrente sobre la MISMA cuenta en el mismo instante —
    // acotado por `MAX_STATUS_RETRY_ATTEMPTS`, nunca sin límite.
    return applySystemStatus(refreshed, to, fields, attempt + 1);
  }
}

interface RecordPaidInvoiceInput {
  invoiceRef: string;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Sella la factura pagada más reciente. El período es MONOTÓNICO: la
 * condición y el `$set` viajan en el mismo `updateOne`, así que un evento
 * viejo entregado fuera de orden (Stripe no garantiza el orden de entrega)
 * no pisa un período más nuevo — ni siquiera `latestInvoiceId`, que viaja en
 * el MISMO documento condicionado, nunca en una escritura aparte sin guarda.
 */
async function recordPaidInvoice(accountId: string, input: RecordPaidInvoiceInput): Promise<void> {
  await SubscriptionAccount.updateOne(
    {
      _id: accountId,
      $or: [{ currentPeriodEnd: { $exists: false } }, { currentPeriodEnd: { $lte: input.periodEnd } }],
    },
    {
      $set: {
        latestInvoiceId: input.invoiceRef,
        currentPeriodStart: input.periodStart,
        currentPeriodEnd: input.periodEnd,
        dunningAttempts: 0,
      },
      $unset: { pastDueSince: 1, dunningInvoiceId: 1 },
    },
  );

  // Independiente de la guarda del período: se sella una sola vez, para
  // siempre, en el primer cobro exitoso que esta cuenta vea.
  await SubscriptionAccount.updateOne(
    { _id: accountId, startedAt: { $exists: false } },
    { $set: { startedAt: new Date() } },
  );
}

/**
 * `dunningAttempts` pasa a ser "intentos de la FACTURA en curso"
 * (`invoice.attempt_count`), no un contador que esta función incrementa —
 * idempotente por construcción: reentregar el mismo `invoice.payment_failed`
 * fija el mismo número, nunca lo duplica.
 *
 * MONOTÓNICO DENTRO DE LA MISMA FACTURA: Stripe no garantiza el orden de
 * entrega, así que el `payment_failed` del intento 1 puede llegar DESPUÉS del
 * intento 3 — sin guarda, ese evento viejo haría retroceder el dunning. Pero
 * `attempt_count` es un contador POR FACTURA (reinicia en 1 cada ciclo), así
 * que la guarda no puede ser sobre el número suelto: una factura que murió en
 * el intento 3 dejaría el contador en 3 y descartaría los primeros intentos
 * del ciclo siguiente (hallazgo de code review). De ahí `dunningInvoiceId`:
 * el `$lte` solo aplica cuando el evento habla de la MISMA factura.
 */
async function recordPaymentFailure(
  accountId: string,
  attemptCount: number,
  invoiceRef: string,
): Promise<void> {
  await SubscriptionAccount.updateOne(
    {
      _id: accountId,
      $or: [{ dunningInvoiceId: { $ne: invoiceRef } }, { dunningAttempts: { $lte: attemptCount } }],
    },
    { $set: { dunningAttempts: attemptCount, dunningInvoiceId: invoiceRef } },
  );
  await SubscriptionAccount.updateOne(
    { _id: accountId, pastDueSince: { $exists: false } },
    { $set: { pastDueSince: new Date() } },
  );
}

/** Período monotónico, igual que `recordPaidInvoice` pero SIN tocar
 * `invoiceId`/`dunningAttempts`: `customer.subscription.updated` y la
 * reanudación no traen una factura, solo el snapshot de período que el
 * proveedor reporta. Nunca retrocede un período ya registrado. */
async function updatePeriodIfNewer(accountId: Types.ObjectId | string, start: Date, end: Date): Promise<void> {
  await SubscriptionAccount.updateOne(
    {
      _id: accountId,
      $or: [{ currentPeriodEnd: { $exists: false } }, { currentPeriodEnd: { $lte: end } }],
    },
    { $set: { currentPeriodStart: start, currentPeriodEnd: end } },
  );
}

export { applySystemStatus, recordPaidInvoice, recordPaymentFailure, updatePeriodIfNewer };
export type { ApplySystemStatusFields, ApplySystemStatusResult, RecordPaidInvoiceInput };
