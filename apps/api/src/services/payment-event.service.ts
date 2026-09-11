import { PAYMENT_EVENT_LEASE_MINUTES } from "@esencia-glow/shared";
import { PaymentEvent, computePaymentEventPurgeAt, type PaymentEventStatus } from "../models/payment-event.model.js";

/**
 * Mecanismo de dedupe de webhooks (§C del plan de 1.6.2): el `insert`
 * ocurre ANTES de despachar el evento — la carrera de reentregas
 * simultáneas la resuelve el índice único de Mongo (E11000), nunca un
 * `findOne` previo. Lease con fencing: `completePaymentEvent`/
 * `failPaymentEvent` solo escriben si `lockedAt` sigue siendo el que
 * devolvió ESTE claim.
 */

const LEASE_MS = PAYMENT_EVENT_LEASE_MINUTES * 60_000;

interface ClaimPaymentEventInput {
  eventId: string;
  type: string;
  now: Date;
}

type ClaimPaymentEventResult =
  | { outcome: "claimed"; lockedAt: Date }
  | { outcome: "duplicate" }
  | { outcome: "in_flight" };

interface MongoDuplicateKeyError {
  code: number;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

/**
 * Reclama un evento para procesarlo. Tres desenlaces:
 * - `claimed`: fila nueva, o una `failed`/`processing`-con-lease-vencido que
 *   ESTA llamada reclamó de forma atómica (`findOneAndUpdate`, no
 *   read-then-write).
 * - `duplicate`: ya se procesó (`processed`/`ignored`) — 200 no-op.
 * - `in_flight`: otra entrega la está procesando AHORA (lease vigente) —
 *   200; esa entrega en vuelo responde por sí sola.
 */
async function claimPaymentEvent(input: ClaimPaymentEventInput): Promise<ClaimPaymentEventResult> {
  try {
    await PaymentEvent.create({
      provider: "stripe",
      eventId: input.eventId,
      type: input.type,
      status: "processing",
      lockedAt: input.now,
      attempts: 1,
      purgeAt: computePaymentEventPurgeAt(input.now),
    });
    return { outcome: "claimed", lockedAt: input.now };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  const leaseThreshold = new Date(input.now.getTime() - LEASE_MS);
  const reclaimed = await PaymentEvent.findOneAndUpdate(
    {
      eventId: input.eventId,
      $or: [{ status: "failed" }, { status: "processing", lockedAt: { $lt: leaseThreshold } }],
    },
    { $set: { status: "processing", lockedAt: input.now }, $inc: { attempts: 1 }, $unset: { error: 1 } },
    { new: true },
  );
  if (reclaimed) return { outcome: "claimed", lockedAt: input.now };

  const existing = await PaymentEvent.findOne({ eventId: input.eventId }).select("status").lean();
  return existing?.status === "processing" ? { outcome: "in_flight" } : { outcome: "duplicate" };
}

interface CompletePaymentEventInput {
  eventId: string;
  lockedAt: Date;
  status: "processed" | "ignored";
  orderId?: string;
}

/** Filtro `{eventId, lockedAt, status: "processing"}` — el fencing: si el
 * lease de ESTA llamada ya expiró y otra reentrega reclamó la fila con un
 * `lockedAt` nuevo, este `findOneAndUpdate` simplemente no encuentra nada
 * que actualizar (no pisa el resultado de la otra). */
async function completePaymentEvent(input: CompletePaymentEventInput): Promise<void> {
  await PaymentEvent.updateOne(
    { eventId: input.eventId, lockedAt: input.lockedAt, status: "processing" },
    { $set: { status: input.status as PaymentEventStatus, ...(input.orderId ? { orderId: input.orderId } : {}) } },
  );
}

interface FailPaymentEventInput {
  eventId: string;
  lockedAt: Date;
  error: string;
  orderId?: string;
}

async function failPaymentEvent(input: FailPaymentEventInput): Promise<void> {
  await PaymentEvent.updateOne(
    { eventId: input.eventId, lockedAt: input.lockedAt, status: "processing" },
    {
      $set: {
        status: "failed" as PaymentEventStatus,
        error: input.error.slice(0, 500),
        ...(input.orderId ? { orderId: input.orderId } : {}),
      },
    },
  );
}

export { claimPaymentEvent, completePaymentEvent, failPaymentEvent };
export type { ClaimPaymentEventResult };
