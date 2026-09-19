import { Types } from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { expireIncompleteSubscriptions } from "../../src/jobs/expire-incomplete-subscriptions.js";
import { startSubscription } from "../../src/services/subscription-seat.service.js";
import { seedPlanWithStripeRefs, seedSubscribedAccount } from "../helpers/subscription-fixtures.js";

const THRESHOLD_MINUTES = 30;

/**
 * `expireIncompleteSubscriptions` (Fase 5 de 1.7.2a, §E del plan) — la red de
 * seguridad para el caso "el proceso murió entre reclamar el cupo y
 * compensar": una cuenta `INCOMPLETE` sin `providerSubscriptionId` que se
 * quedaría así para siempre sin este barrendero. `providerSubscriptionId:
 * {$exists: false}` es la guarda crítica del filtro — jamás debe tocar una
 * cuenta esperando el 3DS de la clienta.
 */
describe("jobs/expireIncompleteSubscriptions", () => {
  async function seedStaleIncompleteAccount(planId: string, minutesAgo = THRESHOLD_MINUTES + 5) {
    const userId = new Types.ObjectId().toString();
    const account = await startSubscription({ userId, planId });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { seatHeldAt: new Date(Date.now() - minutesAgo * 60_000) } },
    );
    return account;
  }

  it("expira una cuenta INCOMPLETE sin providerSubscriptionId cuyo seatHeldAt venció: CANCELED, libera el cupo, audita", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedStaleIncompleteAccount(plan._id.toString());

    const summary = await expireIncompleteSubscriptions(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 1, expired: 1, failed: 0 });
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);
    const audit = await AuditLog.findOne({ action: "subscription_incomplete_expired", targetId: account._id });
    expect(audit).not.toBeNull();
  });

  it("no toca una cuenta INCOMPLETE dentro del umbral (seatHeldAt reciente)", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await startSubscription({ userId: new Types.ObjectId().toString(), planId: plan._id.toString() });

    const summary = await expireIncompleteSubscriptions(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 0, expired: 0, failed: 0 });
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.INCOMPLETE);
  });

  it("NUNCA toca una cuenta INCOMPLETE que ya tiene providerSubscriptionId (esperando 3DS de la clienta)", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedStaleIncompleteAccount(plan._id.toString());
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { providerSubscriptionId: "sub_pending_3ds" } });

    const summary = await expireIncompleteSubscriptions(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 0, expired: 0, failed: 0 });
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(1);
  });

  it("no toca una cuenta ACTIVE aunque su seatHeldAt sea viejo", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { seatHeldAt: new Date(Date.now() - (THRESHOLD_MINUTES + 5) * 60_000) } },
    );

    const summary = await expireIncompleteSubscriptions(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 0, expired: 0, failed: 0 });
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("correr el job dos veces seguidas es idempotente: la segunda pasada no re-expira ni re-audita", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedStaleIncompleteAccount(plan._id.toString());

    const first = await expireIncompleteSubscriptions(new Date(), THRESHOLD_MINUTES);
    expect(first).toEqual({ scanned: 1, expired: 1, failed: 0 });

    // La transición a CANCELED limpia `seatHeldAt` (`applyStatusTransition`,
    // efecto `release`) — la cuenta ya no matchea el filtro del barrendero,
    // así que una segunda pasada en el mismo tick (o el siguiente) no la
    // vuelve a tocar.
    const second = await expireIncompleteSubscriptions(new Date(), THRESHOLD_MINUTES);
    expect(second).toEqual({ scanned: 0, expired: 0, failed: 0 });

    expect(
      await AuditLog.countDocuments({ action: "subscription_incomplete_expired", targetId: account._id }),
    ).toBe(1);
  });
});
