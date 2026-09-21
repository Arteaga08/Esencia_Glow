import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { AppError } from "../../src/utils/app-error.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import {
  abortPlanChange,
  changePlan,
  finalizePlanChange,
} from "../../src/services/subscription-plan-change.service.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import type { SubscriptionProvider } from "../../src/services/subscription-provider.js";
import { applyStatusTransition } from "../../src/services/subscription-seat.service.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { seedManaged, seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

/**
 * Cambio de plan inmediato y sin prorrateo (Milestone 1.7.3). Reclama el cupo
 * del plan NUEVO mientras conserva el viejo (por unos instantes ocupa dos) y
 * deja un marcador `pendingPlanChange`; solo después llama a Stripe. Quien
 * borra el marcador —finalizar, abortar o una re-alta— es DUEÑO de soltar el
 * cupo que corresponda: por eso ninguno de los caminos puede soltar dos veces
 * ni filtrar uno.
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

async function seats(planId: string): Promise<number> {
  return (await SubscriptionPlan.findById(planId))!.seatsTaken;
}

async function reload(accountId: unknown) {
  return SubscriptionAccount.findById(accountId);
}

describe("subscription-plan-change — changePlan", () => {
  it("camino feliz: cupo al plan nuevo, suelta el viejo, cambia planId, borra el marcador y audita {from,to}", async () => {
    const seed = await seedManaged();
    const newPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });

    await changePlan(seed.userId, newPlan._id.toString());

    expect(provider.changePrice).toHaveBeenCalledWith({
      subscriptionRef: seed.subscriptionRef,
      priceRef: newPlan.providerPriceId,
      metadata: { planId: newPlan._id.toString() },
      idempotencyKey: expect.stringMatching(new RegExp(`^account:${seed.accountId.toString()}:plan:\\d+$`)),
    });
    const account = await reload(seed.accountId);
    expect(account?.planId.toString()).toBe(newPlan._id.toString());
    expect(account?.pendingPlanChange).toBeUndefined();
    expect(account?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(await seats(seed.planId)).toBe(0);
    expect(await seats(newPlan._id.toString())).toBe(1);

    const audit = await AuditLog.findOne({ action: "subscription_plan_changed", targetId: seed.accountId });
    expect(audit?.metadata).toMatchObject({ from: seed.planId, to: newPlan._id.toString() });
  });

  it("plan nuevo LLENO: 409, sin marcador, cupos intactos y Stripe nunca se toca", async () => {
    const seed = await seedManaged();
    const fullPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 1 });
    await seedManaged({ planId: fullPlan._id.toString() });

    await expect(changePlan(seed.userId, fullPlan._id.toString())).rejects.toMatchObject({ statusCode: 409 });

    expect(provider.changePrice).not.toHaveBeenCalled();
    expect((await reload(seed.accountId))?.pendingPlanChange).toBeUndefined();
    expect(await seats(seed.planId)).toBe(1);
    expect(await seats(fullPlan._id.toString())).toBe(1);
  });

  it("el MISMO plan -> 409", async () => {
    const seed = await seedManaged();

    await expect(changePlan(seed.userId, seed.planId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.changePrice).not.toHaveBeenCalled();
  });

  it("plan inexistente, inactivo o sin precio en Stripe -> 409, sin tocar cupos", async () => {
    const seed = await seedManaged();
    const inactive = await seedPlanWithStripeRefs();
    await SubscriptionPlan.updateOne({ _id: inactive._id }, { $set: { isActive: false } });
    const noPrice = await seedPlanWithStripeRefs();
    await SubscriptionPlan.updateOne({ _id: noPrice._id }, { $unset: { providerPriceId: 1 } });

    for (const planId of [inactive._id.toString(), noPrice._id.toString(), "cccccccccccccccccccccccc"]) {
      await expect(changePlan(seed.userId, planId)).rejects.toMatchObject({ statusCode: 409 });
    }
    expect(provider.changePrice).not.toHaveBeenCalled();
    expect(await seats(seed.planId)).toBe(1);
  });

  it("moneda distinta -> 409 (un ciclo no puede cambiar de moneda a medias)", async () => {
    const seed = await seedManaged();
    const usdPlan = await seedPlanWithStripeRefs();
    await SubscriptionPlan.updateOne({ _id: usdPlan._id }, { $set: { currency: "usd" } });

    await expect(changePlan(seed.userId, usdPlan._id.toString())).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.changePrice).not.toHaveBeenCalled();
  });

  it.each([SubscriptionStatus.PAST_DUE, SubscriptionStatus.PAUSED, SubscriptionStatus.INCOMPLETE])(
    "estado %s -> 409 (solo desde ACTIVE), sin tocar cupos",
    async (status) => {
      const seed = await seedManaged({ status });
      const newPlan = await seedPlanWithStripeRefs();

      await expect(changePlan(seed.userId, newPlan._id.toString())).rejects.toMatchObject({ statusCode: 409 });
      expect(provider.changePrice).not.toHaveBeenCalled();
      expect(await seats(newPlan._id.toString())).toBe(0);
    },
  );

  it("con cancelAtPeriodEnd pendiente -> 409", async () => {
    const seed = await seedManaged({ cancelAtPeriodEnd: true });
    const newPlan = await seedPlanWithStripeRefs();

    await expect(changePlan(seed.userId, newPlan._id.toString())).rejects.toMatchObject({ statusCode: 409 });
    expect(await seats(newPlan._id.toString())).toBe(0);
  });

  it("con OTRO cambio de plan en curso -> 409 y el cupo del segundo intento no se reclama", async () => {
    const seed = await seedManaged();
    const planB = await seedPlanWithStripeRefs();
    const planC = await seedPlanWithStripeRefs();
    await SubscriptionPlan.updateOne({ _id: planB._id }, { $inc: { seatsTaken: 1 } });
    await SubscriptionAccount.updateOne(
      { _id: seed.accountId },
      { $set: { pendingPlanChange: { planId: planB._id, requestedAt: new Date() } } },
    );

    await expect(changePlan(seed.userId, planC._id.toString())).rejects.toMatchObject({ statusCode: 409 });
    expect(await seats(planC._id.toString())).toBe(0);
  });

  it("si Stripe RECHAZA el cambio (409, definitivo): rollback COMPLETO (cupo nuevo liberado, marcador borrado, plan intacto) y el error original sube", async () => {
    const seed = await seedManaged();
    const newPlan = await seedPlanWithStripeRefs();
    useProvider({
      changePrice: vi.fn().mockRejectedValue(new AppError("La suscripción ya no admite ese cambio.", 409)),
    });

    await expect(changePlan(seed.userId, newPlan._id.toString())).rejects.toMatchObject({ statusCode: 409 });

    const account = await reload(seed.accountId);
    expect(account?.planId.toString()).toBe(seed.planId);
    expect(account?.pendingPlanChange).toBeUndefined();
    expect(await seats(seed.planId)).toBe(1);
    expect(await seats(newPlan._id.toString())).toBe(0);
    expect(await AuditLog.countDocuments({ action: "subscription_plan_changed" })).toBe(0);
  });

  it("un error AMBIGUO de Stripe (502: timeout/red, puede haberse aplicado) NO aborta: conserva el marcador y ambos cupos para que el reconciliador decida", async () => {
    const seed = await seedManaged();
    const newPlan = await seedPlanWithStripeRefs();
    useProvider({ changePrice: vi.fn().mockRejectedValue(new AppError("Stripe caído", 502)) });

    await expect(changePlan(seed.userId, newPlan._id.toString())).rejects.toMatchObject({ statusCode: 502 });

    const account = await reload(seed.accountId);
    expect(account?.pendingPlanChange?.planId.toString()).toBe(newPlan._id.toString());
    expect(account?.planId.toString()).toBe(seed.planId);
    // Aborter aquí liberaría el cupo nuevo aunque Stripe ya cobre el precio nuevo.
    expect(await seats(seed.planId)).toBe(1);
    expect(await seats(newPlan._id.toString())).toBe(1);
    expect(await AuditLog.countDocuments({ action: "subscription_plan_changed" })).toBe(0);
  });

  it("dos cambios SIMULTÁNEOS de la misma cuenta a planes distintos: gana uno, el otro 409, y los cupos cuadran", async () => {
    const seed = await seedManaged();
    const planB = await seedPlanWithStripeRefs();
    const planC = await seedPlanWithStripeRefs();

    const results = await Promise.allSettled([
      changePlan(seed.userId, planB._id.toString()),
      changePlan(seed.userId, planC._id.toString()),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const total =
      (await seats(seed.planId)) + (await seats(planB._id.toString())) + (await seats(planC._id.toString()));
    expect(total).toBe(1);
    expect((await reload(seed.accountId))?.pendingPlanChange).toBeUndefined();
  });
});

describe("subscription-plan-change — finalizePlanChange / abortPlanChange (recuperación)", () => {
  /** Estado de un cambio a medias: cupo reclamado en el plan nuevo + marcador. */
  async function seedPending() {
    const seed = await seedManaged();
    const newPlan = await seedPlanWithStripeRefs();
    const requestedAt = new Date();
    await SubscriptionPlan.updateOne({ _id: newPlan._id }, { $inc: { seatsTaken: 1 } });
    await SubscriptionAccount.updateOne(
      { _id: seed.accountId },
      { $set: { pendingPlanChange: { planId: newPlan._id, requestedAt } } },
    );
    return { ...seed, newPlanId: newPlan._id.toString(), requestedAt };
  }

  it("finalize: pasa al plan nuevo, suelta el viejo, borra el marcador -> 'finalized'", async () => {
    const seed = await seedPending();

    const outcome = await finalizePlanChange(seed.accountId, seed.requestedAt);

    expect(outcome).toBe("finalized");
    const account = await reload(seed.accountId);
    expect(account?.planId.toString()).toBe(seed.newPlanId);
    expect(account?.pendingPlanChange).toBeUndefined();
    expect(await seats(seed.planId)).toBe(0);
    expect(await seats(seed.newPlanId)).toBe(1);
  });

  it("finalize es idempotente: la segunda llamada es 'noop' y NO suelta un cupo de más", async () => {
    const seed = await seedPending();
    await finalizePlanChange(seed.accountId, seed.requestedAt);

    expect(await finalizePlanChange(seed.accountId, seed.requestedAt)).toBe("noop");

    expect(await seats(seed.planId)).toBe(0);
    expect(await seats(seed.newPlanId)).toBe(1);
  });

  it("finalize con un requestedAt que ya NO es el vigente (otro intento lo reemplazó): 'noop', nada cambia", async () => {
    const seed = await seedPending();

    expect(await finalizePlanChange(seed.accountId, new Date(seed.requestedAt.getTime() - 1000))).toBe("noop");

    expect((await reload(seed.accountId))?.pendingPlanChange).toBeDefined();
    expect(await seats(seed.newPlanId)).toBe(1);
  });

  it("finalize sobre una cuenta que un webhook CANCELÓ a media operación: suelta solo el cupo NUEVO (el viejo ya lo soltó la cancelación) y borra el marcador", async () => {
    const seed = await seedPending();
    const current = await reload(seed.accountId);
    await applyStatusTransition(current!, SubscriptionStatus.CANCELED, "system");
    expect(await seats(seed.planId)).toBe(0);

    const outcome = await finalizePlanChange(seed.accountId, seed.requestedAt);

    expect(outcome).toBe("finalized");
    expect(await seats(seed.planId)).toBe(0);
    expect(await seats(seed.newPlanId)).toBe(0);
    expect((await reload(seed.accountId))?.pendingPlanChange).toBeUndefined();
  });

  it("abort: suelta el cupo nuevo, borra el marcador y conserva el plan -> 'aborted'; idempotente", async () => {
    const seed = await seedPending();

    expect(await abortPlanChange(seed.accountId, seed.requestedAt)).toBe("aborted");
    expect(await abortPlanChange(seed.accountId, seed.requestedAt)).toBe("noop");

    const account = await reload(seed.accountId);
    expect(account?.planId.toString()).toBe(seed.planId);
    expect(account?.pendingPlanChange).toBeUndefined();
    expect(await seats(seed.planId)).toBe(1);
    expect(await seats(seed.newPlanId)).toBe(0);
  });

  it("finalize y abort en CARRERA por el mismo marcador: exactamente uno lo consume y los cupos suman 1", async () => {
    const seed = await seedPending();

    await Promise.all([
      finalizePlanChange(seed.accountId, seed.requestedAt),
      abortPlanChange(seed.accountId, seed.requestedAt),
    ]);

    const total = (await seats(seed.planId)) + (await seats(seed.newPlanId));
    expect(total).toBe(1);
    expect((await reload(seed.accountId))?.pendingPlanChange).toBeUndefined();
  });
});
