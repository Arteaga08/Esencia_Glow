import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/utils/app-error.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { reconcilePendingPlanChanges } from "../../src/jobs/reconcile-pending-plan-changes.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import type { SubscriptionProvider } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { seedManaged, seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

const THRESHOLD_MINUTES = 15;

/**
 * `reconcilePendingPlanChanges` (Milestone 1.7.3) — la red de seguridad de un
 * cambio de plan que quedó a medias: el proceso murió entre reclamar el cupo
 * del plan nuevo y confirmarlo contra Stripe. Pregunta a Stripe qué precio
 * tiene la suscripción y actúa en consecuencia: si ya es el nuevo, finaliza;
 * si sigue el viejo, aborta.
 */

let provider: SubscriptionProvider;

function useProvider(overrides: Partial<SubscriptionProvider> = {}): SubscriptionProvider {
  provider = buildFakeSubscriptionProvider(overrides);
  __setSubscriptionProviderForTests(provider);
  return provider;
}

beforeEach(() => {
  useProvider();
});

/** Cambio a medias con el marcador `minutesAgo` minutos de antigüedad. */
async function seedStalePending(minutesAgo = THRESHOLD_MINUTES + 5) {
  const seed = await seedManaged();
  const newPlan = await seedPlanWithStripeRefs();
  await SubscriptionPlan.updateOne({ _id: newPlan._id }, { $inc: { seatsTaken: 1 } });
  await SubscriptionAccount.updateOne(
    { _id: seed.accountId },
    { $set: { pendingPlanChange: { planId: newPlan._id, requestedAt: new Date(Date.now() - minutesAgo * 60_000) } } },
  );
  return { ...seed, newPlan };
}

function providerReporting(subscriptionRef: string, priceRef: string): Partial<SubscriptionProvider> {
  return {
    getSubscription: vi.fn().mockResolvedValue({
      subscriptionRef,
      status: "active",
      collectionPaused: false,
      cancelAtPeriodEnd: false,
      priceRef,
    }),
  };
}

async function seats(planId: string): Promise<number> {
  return (await SubscriptionPlan.findById(planId))!.seatsTaken;
}

describe("jobs/reconcilePendingPlanChanges", () => {
  it("Stripe YA tiene el precio nuevo -> finaliza: plan nuevo, cupo viejo liberado, marcador borrado, audita 'finalized'", async () => {
    const seed = await seedStalePending();
    useProvider(providerReporting(seed.subscriptionRef, seed.newPlan.providerPriceId!));

    const summary = await reconcilePendingPlanChanges(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 1, finalized: 1, aborted: 0, failed: 0 });
    const account = await SubscriptionAccount.findById(seed.accountId);
    expect(account?.planId.toString()).toBe(seed.newPlan._id.toString());
    expect(account?.pendingPlanChange).toBeUndefined();
    expect(await seats(seed.planId)).toBe(0);
    expect(await seats(seed.newPlan._id.toString())).toBe(1);
    const audit = await AuditLog.findOne({ action: "subscription_plan_change_reconciled", targetId: seed.accountId });
    expect(audit?.metadata).toMatchObject({ outcome: "finalized" });
  });

  it("Stripe sigue con el precio VIEJO -> aborta: suelta el cupo nuevo, conserva el plan, audita 'aborted'", async () => {
    const seed = await seedStalePending();
    useProvider(providerReporting(seed.subscriptionRef, "price_fake_initial"));

    const summary = await reconcilePendingPlanChanges(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 1, finalized: 0, aborted: 1, failed: 0 });
    const account = await SubscriptionAccount.findById(seed.accountId);
    expect(account?.planId.toString()).toBe(seed.planId);
    expect(account?.pendingPlanChange).toBeUndefined();
    expect(await seats(seed.planId)).toBe(1);
    expect(await seats(seed.newPlan._id.toString())).toBe(0);
    const audit = await AuditLog.findOne({ action: "subscription_plan_change_reconciled", targetId: seed.accountId });
    expect(audit?.metadata).toMatchObject({ outcome: "aborted" });
  });

  it("un marcador MÁS JOVEN que el umbral no se toca (su changePlan puede seguir en vuelo) y no consulta a Stripe", async () => {
    const seed = await seedStalePending(1);

    const summary = await reconcilePendingPlanChanges(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 0, finalized: 0, aborted: 0, failed: 0 });
    expect(provider.getSubscription).not.toHaveBeenCalled();
    expect((await SubscriptionAccount.findById(seed.accountId))?.pendingPlanChange).toBeDefined();
  });

  it("un error del proveedor cuenta como failed, NO lanza y deja el marcador para el siguiente tick", async () => {
    const seed = await seedStalePending();
    useProvider({ getSubscription: vi.fn().mockRejectedValue(new AppError("Stripe caído", 502)) });

    const summary = await reconcilePendingPlanChanges(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 1, finalized: 0, aborted: 0, failed: 1 });
    expect((await SubscriptionAccount.findById(seed.accountId))?.pendingPlanChange).toBeDefined();
  });

  it("un fallo en una cuenta no impide reconciliar las demás del lote", async () => {
    const broken = await seedStalePending();
    const healthy = await seedStalePending();
    useProvider({
      getSubscription: vi.fn().mockImplementation(async (ref: string) => {
        if (ref === broken.subscriptionRef) throw new AppError("Stripe caído", 502);
        return { subscriptionRef: ref, status: "active", collectionPaused: false, cancelAtPeriodEnd: false, priceRef: "price_fake_initial" };
      }),
    });

    const summary = await reconcilePendingPlanChanges(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 2, finalized: 0, aborted: 1, failed: 1 });
    expect((await SubscriptionAccount.findById(healthy.accountId))?.pendingPlanChange).toBeUndefined();
  });

  it("marcador ya consumido por otro camino entre el barrido y la resolución (webhook): no cuenta ni audita", async () => {
    const seed = await seedStalePending();
    useProvider({
      getSubscription: vi.fn().mockImplementation(async (ref: string) => {
        // El webhook `.updated` finaliza justo mientras el job consulta a Stripe.
        await SubscriptionAccount.updateOne({ _id: seed.accountId }, { $unset: { pendingPlanChange: 1 } });
        return { subscriptionRef: ref, status: "active", collectionPaused: false, cancelAtPeriodEnd: false, priceRef: "price_fake_initial" };
      }),
    });

    const summary = await reconcilePendingPlanChanges(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 1, finalized: 0, aborted: 0, failed: 0 });
    expect(await AuditLog.countDocuments({ action: "subscription_plan_change_reconciled" })).toBe(0);
  });

  it("sin proveedor configurado (entorno sin Stripe) no hace nada y no lanza", async () => {
    await seedStalePending();
    __setSubscriptionProviderForTests(undefined);

    const summary = await reconcilePendingPlanChanges(new Date(), THRESHOLD_MINUTES);

    expect(summary).toEqual({ scanned: 0, finalized: 0, aborted: 0, failed: 0 });
  });
});
