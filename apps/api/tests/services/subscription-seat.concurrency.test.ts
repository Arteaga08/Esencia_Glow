import mongoose from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { applyStatusTransition, startSubscription } from "../../src/services/subscription-seat.service.js";

/**
 * Suite de contención real contra Mongo en memoria — calcada de
 * stock-reservation.concurrency.test.ts. Aserciones sobre INVARIANTES, nunca
 * sobre orden: `Promise.allSettled`, nunca `Promise.all`.
 */

let seedCounter = 0;

async function seedPlan(maxActiveSeats: number, overrides: Partial<Record<string, unknown>> = {}) {
  seedCounter += 1;
  return SubscriptionPlan.create({
    name: `Plan ${seedCounter}`,
    slug: `plan-${seedCounter}`,
    description: "d",
    priceCents: 49900,
    maxActiveSeats,
    ...overrides,
  });
}

describe("services/subscription-seat — concurrencia real", () => {
  it("cupo agotado clásico: maxActiveSeats=3, 10 altas en paralelo -> exactamente 3 ganan", async () => {
    const plan = await seedPlan(3);

    const attempts = Array.from({ length: 10 }, () =>
      startSubscription({ userId: new mongoose.Types.ObjectId().toString(), planId: plan._id.toString() }),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(7);
    expect(rejected.every((r) => r.reason.statusCode === 409)).toBe(true);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(3);

    // Aserción cruzada entre colecciones: la única forma de detectar un
    // read-then-write que dejó el contador alto sin las cuentas que lo
    // respaldan, o al revés.
    const heldCount = await SubscriptionAccount.countDocuments({
      planId: plan._id,
      seatHeldAt: { $exists: true },
    });
    expect(heldCount).toBe(refreshedPlan?.seatsTaken);
  }, 30_000);

  it("doble alta simultánea de la misma usuaria: una gana, la otra 409 (unique userId); seatsTaken sube una sola vez", async () => {
    const plan = await seedPlan(5);
    const userId = new mongoose.Types.ObjectId().toString();

    const results = await Promise.allSettled([
      startSubscription({ userId, planId: plan._id.toString() }),
      startSubscription({ userId, planId: plan._id.toString() }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason.statusCode).toBe(409);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);

    const accounts = await SubscriptionAccount.countDocuments({ userId });
    expect(accounts).toBe(1);
  }, 30_000);

  it("alta vs. bajar maxActiveSeats en carrera: nunca seatsTaken > maxActiveSeats, cero 500", async () => {
    const plan = await seedPlan(5);

    const altas = Array.from({ length: 5 }, () =>
      startSubscription({ userId: new mongoose.Types.ObjectId().toString(), planId: plan._id.toString() }),
    );
    const lowerCap = SubscriptionPlan.findOneAndUpdate(
      { _id: plan._id, $expr: { $lte: ["$seatsTaken", 2] } },
      { $set: { maxActiveSeats: 2 } },
      { new: true },
    );

    const results = await Promise.allSettled([...altas, lowerCap]);
    const rejectedAltas = results.slice(0, 5).filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    // Ninguna promesa debe rechazar con algo que no sea un AppError con
    // statusCode — un WriteConflict escapado sin traducir sería un 500.
    for (const r of rejectedAltas) {
      expect(typeof r.reason.statusCode).toBe("number");
    }

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan!.seatsTaken).toBeLessThanOrEqual(refreshedPlan!.maxActiveSeats);
  }, 30_000);

  it("maxActiveSeats: 0 -> toda alta responde 409 sin crear ningún documento", async () => {
    const plan = await seedPlan(0);

    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        startSubscription({ userId: new mongoose.Types.ObjectId().toString(), planId: plan._id.toString() }),
      ),
    );

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(await SubscriptionAccount.countDocuments({ planId: plan._id })).toBe(0);
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("cancelar y volver a suscribirse libera y vuelve a tomar el cupo: el contador queda cuadrado", async () => {
    const plan = await seedPlan(1);
    const userId = new mongoose.Types.ObjectId().toString();

    const account = await startSubscription({ userId, planId: plan._id.toString() });
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(1);

    // Simula el cierre de ciclo (webhook, 1.7.2): system cancela la cuenta.
    await applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);

    const resubscribed = await startSubscription({ userId, planId: plan._id.toString() });
    expect(resubscribed._id.toString()).toBe(account._id.toString());
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(1);
    expect(await SubscriptionAccount.countDocuments({ userId })).toBe(1);
  });

  it("pausar libera el lugar y otra alta lo toma de inmediato; reanudar con el plan lleno -> 409 y la cuenta sigue PAUSED", async () => {
    const plan = await seedPlan(1);
    const firstUserId = new mongoose.Types.ObjectId().toString();
    const secondUserId = new mongoose.Types.ObjectId().toString();

    const firstAccount = await startSubscription({ userId: firstUserId, planId: plan._id.toString() });
    const activated = await applyStatusTransition(firstAccount, SubscriptionStatus.ACTIVE, "system");
    const paused = await applyStatusTransition(activated, SubscriptionStatus.PAUSED, "customer");
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);

    const secondAccount = await startSubscription({ userId: secondUserId, planId: plan._id.toString() });
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(1);

    await expect(applyStatusTransition(paused, SubscriptionStatus.ACTIVE, "customer")).rejects.toMatchObject({
      statusCode: 409,
    });

    const stillPaused = await SubscriptionAccount.findById(paused._id);
    expect(stillPaused?.status).toBe(SubscriptionStatus.PAUSED);
    void secondAccount;
  });
});
