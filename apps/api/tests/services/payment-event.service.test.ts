import { PAYMENT_EVENT_LEASE_MINUTES } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { PaymentEvent } from "../../src/models/payment-event.model.js";
import { claimPaymentEvent, completePaymentEvent, failPaymentEvent } from "../../src/services/payment-event.service.js";

/**
 * `payment-event.service.ts` — el mecanismo de dedupe real (§4 del plan de
 * 1.6.2): el `insert` ocurre ANTES de despachar, así que la carrera de dos
 * reentregas simultáneas se resuelve en la base (E11000), nunca en un
 * `findOne` previo (read-then-write).
 */
describe("services/payment-event — claimPaymentEvent", () => {
  it("primer claim de un evento nuevo -> claimed", async () => {
    const result = await claimPaymentEvent({ eventId: "evt_1", type: "payment_intent.succeeded", now: new Date() });
    expect(result.outcome).toBe("claimed");

    const stored = await PaymentEvent.findOne({ eventId: "evt_1" });
    expect(stored?.status).toBe("processing");
    expect(stored?.attempts).toBe(1);
  });

  it("segundo claim tras processed -> duplicate", async () => {
    const now = new Date();
    const first = await claimPaymentEvent({ eventId: "evt_2", type: "payment_intent.succeeded", now });
    if (first.outcome !== "claimed") throw new Error("setup: se esperaba claimed");
    await completePaymentEvent({ eventId: "evt_2", lockedAt: first.lockedAt, status: "processed" });

    const second = await claimPaymentEvent({ eventId: "evt_2", type: "payment_intent.succeeded", now: new Date() });
    expect(second.outcome).toBe("duplicate");
  });

  it("claim sobre una fila processing reciente -> in_flight", async () => {
    const now = new Date();
    await claimPaymentEvent({ eventId: "evt_3", type: "payment_intent.succeeded", now });

    const second = await claimPaymentEvent({ eventId: "evt_3", type: "payment_intent.succeeded", now: new Date() });
    expect(second.outcome).toBe("in_flight");
  });

  it("claim sobre una fila processing con lease vencido -> claimed, attempts sube a 2", async () => {
    const staleNow = new Date(Date.now() - (PAYMENT_EVENT_LEASE_MINUTES + 1) * 60_000);
    await claimPaymentEvent({ eventId: "evt_4", type: "payment_intent.succeeded", now: staleNow });

    const reclaim = await claimPaymentEvent({ eventId: "evt_4", type: "payment_intent.succeeded", now: new Date() });
    expect(reclaim.outcome).toBe("claimed");

    const stored = await PaymentEvent.findOne({ eventId: "evt_4" });
    expect(stored?.attempts).toBe(2);
    expect(stored?.status).toBe("processing");
  });

  it("evento failed -> reclamable de inmediato (sin esperar el lease)", async () => {
    const now = new Date();
    const first = await claimPaymentEvent({ eventId: "evt_5", type: "payment_intent.payment_failed", now });
    if (first.outcome !== "claimed") throw new Error("setup: se esperaba claimed");
    await failPaymentEvent({ eventId: "evt_5", lockedAt: first.lockedAt, error: "fallo transitorio" });

    const reclaim = await claimPaymentEvent({ eventId: "evt_5", type: "payment_intent.payment_failed", now: new Date() });
    expect(reclaim.outcome).toBe("claimed");

    const stored = await PaymentEvent.findOne({ eventId: "evt_5" });
    expect(stored?.error).toBeUndefined();
  });

  it("🔀 5 claims simultáneos del mismo eventId -> exactamente 1 claimed", async () => {
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimPaymentEvent({ eventId: "evt_race", type: "payment_intent.succeeded", now })),
    );

    const claimed = results.filter((r) => r.outcome === "claimed");
    expect(claimed).toHaveLength(1);
  });

  it("fencing: completePaymentEvent con un lockedAt viejo no modifica la fila", async () => {
    const now = new Date();
    const first = await claimPaymentEvent({ eventId: "evt_6", type: "payment_intent.succeeded", now });
    if (first.outcome !== "claimed") throw new Error("setup: se esperaba claimed");

    // Simula una entrega vieja intentando completar DESPUÉS de que el lease
    // expiró y otra reentrega ya reclamó la fila con un lockedAt nuevo.
    const staleLockedAt = new Date(first.lockedAt.getTime() - 1000);
    await completePaymentEvent({ eventId: "evt_6", lockedAt: staleLockedAt, status: "processed" });

    const stored = await PaymentEvent.findOne({ eventId: "evt_6" });
    expect(stored?.status).toBe("processing");
  });

  it("el índice TTL existe sobre purgeAt", async () => {
    const indexes = await PaymentEvent.collection.indexes();
    const ttlIndex = indexes.find((idx) => idx.key && "purgeAt" in idx.key);
    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });
});
