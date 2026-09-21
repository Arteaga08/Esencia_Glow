import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { applyStatusTransition, startSubscription } from "../../src/services/subscription-seat.service.js";
import { seedPlanWithStripeRefs, seedSubscribedAccount } from "../helpers/subscription-fixtures.js";

/**
 * Reactivación `CANCELED -> INCOMPLETE` (hallazgo de code review de la Fase 4
 * de 1.7.2a): una cuenta cancelada con `providerSubscriptionId` de la
 * suscripción VIEJA de Stripe no puede quedar `INCOMPLETE` con ese ref
 * todavía puesto — un webhook tardío de esa suscripción cancelada la
 * encontraría por ese ref (`locateAccountForEvent`) y podría mover el estado
 * antes de que el endpoint de alta persista el ref de la suscripción NUEVA.
 */
describe("services/subscription-seat — reactivación CANCELED -> INCOMPLETE", () => {
  it("limpia el providerSubscriptionId VIEJO, conserva el providerCustomerId", async () => {
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const account = await startSubscription({
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      planId: plan._id.toString(),
    });

    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { providerCustomerId: "cus_old", providerSubscriptionId: "sub_old" } },
    );
    const withOldRefs = await SubscriptionAccount.findById(account._id);
    await applyStatusTransition(withOldRefs!, SubscriptionStatus.CANCELED, "system");

    const reactivated = await startSubscription({
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      planId: plan._id.toString(),
    });

    expect(reactivated.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(reactivated.providerSubscriptionId).toBeUndefined();
    expect(reactivated.providerCustomerId).toBe("cus_old");
  });
});

/**
 * `extra` de `applyStatusTransition` (1.7.3): `set`/`unset` viajan en el MISMO
 * update atómico que la transición (así `pausedAt`/`canceledAt` nunca quedan
 * desincronizados del estado) y `guard` endurece el CAS más allá del status.
 */
describe("services/subscription-seat — applyStatusTransition con extra", () => {
  async function seedActive(maxActiveSeats = 5) {
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
    return { plan, account };
  }

  it("set y unset se escriben junto con la transición, en un solo update", async () => {
    const { account } = await seedActive();
    const pausedAt = new Date("2026-09-20T12:00:00Z");
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { cancelReason: "residuo" } });
    const fresh = await SubscriptionAccount.findById(account._id);

    const paused = await applyStatusTransition(fresh!, SubscriptionStatus.PAUSED, "customer", undefined, {
      set: { pausedAt },
      unset: ["cancelReason"],
    });

    expect(paused.status).toBe(SubscriptionStatus.PAUSED);
    expect(paused.pausedAt?.getTime()).toBe(pausedAt.getTime());
    expect(paused.cancelReason).toBeUndefined();
  });

  it("un guard que ya no se cumple pierde el CAS: 409 y NADA cambia (ni estado ni cupo)", async () => {
    const { plan, account } = await seedActive();
    // Otro escritor marcó la cancelación entre la lectura y la transición.
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { cancelAtPeriodEnd: true } });

    await expect(
      applyStatusTransition(account, SubscriptionStatus.PAUSED, "customer", undefined, {
        guard: { cancelAtPeriodEnd: false },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.ACTIVE);
    // El `releaseSeat` corrió dentro de la misma transacción que abortó.
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(1);
  });

  it("un guard que se cumple deja pasar la transición", async () => {
    const { account } = await seedActive();

    const paused = await applyStatusTransition(account, SubscriptionStatus.PAUSED, "customer", undefined, {
      guard: { cancelAtPeriodEnd: false },
    });

    expect(paused.status).toBe(SubscriptionStatus.PAUSED);
  });

  it("sin extra el comportamiento previo no cambia", async () => {
    const { account } = await seedActive();

    const paused = await applyStatusTransition(account, SubscriptionStatus.PAUSED, "customer");

    expect(paused.status).toBe(SubscriptionStatus.PAUSED);
    expect(paused.pausedAt).toBeUndefined();
  });
});

describe("services/subscription-seat — reactivación limpia el estado de autoservicio (1.7.3)", () => {
  it("pausedAt y pendingPlanChange no sobreviven a una re-alta", async () => {
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          pausedAt: new Date(),
          pendingPlanChange: { planId: plan._id, requestedAt: new Date() },
        },
      },
    );
    const withResidue = await SubscriptionAccount.findById(account._id);
    expect(withResidue?.pendingPlanChange).toBeDefined();
    await applyStatusTransition(withResidue!, SubscriptionStatus.CANCELED, "system");

    const reactivated = await startSubscription({ userId: account.userId.toString(), planId: plan._id.toString() });

    expect(reactivated.pausedAt).toBeUndefined();
    expect(reactivated.pendingPlanChange).toBeUndefined();
  });
});

describe("services/subscription-seat — re-alta con un cambio de plan huérfano (1.7.3)", () => {
  it("quien borra el marcador suelta el cupo del plan NUEVO: no se filtra", async () => {
    const oldPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const newPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const account = await seedSubscribedAccount({ planId: oldPlan._id.toString(), status: SubscriptionStatus.ACTIVE });
    // Estado de un cambio de plan a medias: cupo reclamado en el plan nuevo + marcador.
    await SubscriptionPlan.updateOne({ _id: newPlan._id }, { $inc: { seatsTaken: 1 } });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { pendingPlanChange: { planId: newPlan._id, requestedAt: new Date() } } },
    );
    const withMarker = await SubscriptionAccount.findById(account._id);
    await applyStatusTransition(withMarker!, SubscriptionStatus.CANCELED, "system");

    await startSubscription({ userId: account.userId.toString(), planId: oldPlan._id.toString() });

    expect((await SubscriptionPlan.findById(newPlan._id))?.seatsTaken).toBe(0);
    expect((await SubscriptionPlan.findById(oldPlan._id))?.seatsTaken).toBe(1);
  });
});

describe("services/subscription-seat — el CAS cubre el planId (hallazgo de code review de 1.7.3)", () => {
  it("una transición con un documento VIEJO tras un cambio de plan pierde el CAS y NO suelta el cupo del plan equivocado", async () => {
    const oldPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const newPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const account = await seedSubscribedAccount({ planId: oldPlan._id.toString(), status: SubscriptionStatus.ACTIVE });
    const stale = await SubscriptionAccount.findById(account._id);

    // Un cambio de plan termina mientras `stale` sigue en memoria: cambia
    // `planId` y mueve el cupo, pero el `status` sigue siendo ACTIVE.
    await SubscriptionPlan.updateOne({ _id: newPlan._id }, { $inc: { seatsTaken: 1 } });
    await SubscriptionPlan.updateOne({ _id: oldPlan._id }, { $inc: { seatsTaken: -1 } });
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { planId: newPlan._id } });

    await expect(applyStatusTransition(stale!, SubscriptionStatus.PAUSED, "customer")).rejects.toMatchObject({
      statusCode: 409,
    });

    // Sin el `planId` en el CAS, esto habría decrementado el plan VIEJO (ya en 0).
    expect((await SubscriptionPlan.findById(oldPlan._id))?.seatsTaken).toBe(0);
    expect((await SubscriptionPlan.findById(newPlan._id))?.seatsTaken).toBe(1);
    expect((await SubscriptionAccount.findById(account._id))?.status).toBe(SubscriptionStatus.ACTIVE);
  });
});
