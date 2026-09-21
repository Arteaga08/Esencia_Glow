import { beforeEach, describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { changePlan } from "../../src/services/subscription-plan-change.service.js";
import { pauseSubscription, resumeSubscription } from "../../src/services/subscription-self-service.service.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { seedManaged, seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

/**
 * Concurrencia real del autoservicio (Milestone 1.7.3) contra Mongo: los
 * invariantes que importan son que `seatsTaken` nunca supere `maxActiveSeats`
 * y que el estado local y el del proveedor no queden contradiciéndose.
 */

beforeEach(() => {
  __setSubscriptionProviderForTests(buildFakeSubscriptionProvider());
});

async function seats(planId: string): Promise<number> {
  return (await SubscriptionPlan.findById(planId))!.seatsTaken;
}

describe("subscription-self-service — concurrencia", () => {
  it("dos pausadas reanudan a la vez por el ÚLTIMO cupo: una gana, la otra 409, seatsTaken nunca pasa del tope", async () => {
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 1 });
    const planId = plan._id.toString();
    const first = await seedManaged({ planId, status: SubscriptionStatus.PAUSED });
    const second = await seedManaged({ planId, status: SubscriptionStatus.PAUSED });
    expect(await seats(planId)).toBe(0);

    const results = await Promise.allSettled([resumeSubscription(first.userId), resumeSubscription(second.userId)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ statusCode: 409 });
    expect(await seats(planId)).toBe(1);
    const active = await SubscriptionAccount.countDocuments({ planId, status: SubscriptionStatus.ACTIVE });
    expect(active).toBe(1);
  });

  it("el MISMO doble clic en 'reanudar': una gana, la otra 409 y el cupo se reclama UNA sola vez", async () => {
    const seed = await seedManaged({ status: SubscriptionStatus.PAUSED });

    const results = await Promise.allSettled([resumeSubscription(seed.userId), resumeSubscription(seed.userId)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await seats(seed.planId)).toBe(1);
  });

  it("pausar en carrera con cambiar de plan: nunca quedan cupos filtrados ni un marcador huérfano", async () => {
    const seed = await seedManaged();
    const newPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const newPlanId = newPlan._id.toString();

    await Promise.allSettled([pauseSubscription(seed.userId), changePlan(seed.userId, newPlanId)]);

    const account = await SubscriptionAccount.findById(seed.accountId);
    expect(account?.pendingPlanChange).toBeUndefined();
    const totalSeats = (await seats(seed.planId)) + (await seats(newPlanId));
    // Pausada = sin cupo; activa (con o sin plan nuevo) = exactamente uno.
    expect(totalSeats).toBe(account?.status === SubscriptionStatus.PAUSED ? 0 : 1);
    if (account?.status === SubscriptionStatus.ACTIVE) {
      // El cupo está en el plan que la cuenta dice tener.
      expect(await seats(account.planId.toString())).toBe(1);
    }
  });
});
