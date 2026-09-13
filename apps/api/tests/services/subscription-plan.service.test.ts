import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import {
  createPlan,
  deactivatePlan,
  getPlanById,
  updatePlan,
} from "../../src/services/subscription-plan.service.js";
import { startSubscription } from "../../src/services/subscription-seat.service.js";

function buildInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Caja Esencial",
    description: "Descripción de la caja",
    priceCents: 49900,
    maxActiveSeats: 100,
    ...overrides,
  };
}

describe("services/subscription-plan", () => {
  it("crea un plan con slug derivado del nombre", async () => {
    const plan = await createPlan(buildInput({ name: "Caja Súper Especial" }));
    expect(plan.slug).toBe("caja-super-especial");
  });

  it("bajar maxActiveSeats por debajo de seatsTaken responde 409 y no cambia el documento", async () => {
    const plan = await createPlan(buildInput());
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { seatsTaken: 5 } });

    await expect(updatePlan(plan._id.toString(), { maxActiveSeats: 3 })).rejects.toMatchObject({
      statusCode: 409,
    });

    const unchanged = await SubscriptionPlan.findById(plan._id);
    expect(unchanged?.maxActiveSeats).toBe(100);
  });

  it("bajar maxActiveSeats hasta exactamente seatsTaken sí se permite", async () => {
    const plan = await createPlan(buildInput());
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { seatsTaken: 5 } });

    const updated = await updatePlan(plan._id.toString(), { maxActiveSeats: 5 });
    expect(updated.maxActiveSeats).toBe(5);
  });

  it("cambiar priceCents con suscriptoras activas responde 409", async () => {
    const plan = await createPlan(buildInput());
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { seatsTaken: 1 } });

    await expect(updatePlan(plan._id.toString(), { priceCents: 59900 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("cambiar priceCents sin suscriptoras se permite", async () => {
    const plan = await createPlan(buildInput());
    const updated = await updatePlan(plan._id.toString(), { priceCents: 59900 });
    expect(updated.priceCents).toBe(59900);
  });

  it("desactivar un plan con suscriptoras activas responde 409", async () => {
    const plan = await createPlan(buildInput());
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { seatsTaken: 1 } });

    await expect(deactivatePlan(plan._id.toString())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("desactivar un plan sin suscriptoras lo deja isActive:false, sin borrarlo", async () => {
    const plan = await createPlan(buildInput());
    await deactivatePlan(plan._id.toString());

    const found = await getPlanById(plan._id.toString());
    expect(found.isActive).toBe(false);
  });

  it("actualizar un plan inexistente responde 404", async () => {
    const fakeId = "aaaaaaaaaaaaaaaaaaaaaaaa";
    await expect(updatePlan(fakeId, { name: "x" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("desactivar un plan nunca deja isActive:false con seatsTaken>0, ni bajo una alta concurrente", async () => {
    const plan = await createPlan(buildInput({ maxActiveSeats: 5 }));

    const results = await Promise.allSettled([
      deactivatePlan(plan._id.toString()),
      startSubscription({ userId: new mongoose.Types.ObjectId().toString(), planId: plan._id.toString() }),
    ]);

    const refreshed = await SubscriptionPlan.findById(plan._id);
    // Cualquiera de las dos combinaciones válidas está bien (el orden real
    // de la carrera es no determinista); lo que NUNCA puede pasar es la
    // combinación inconsistente: desactivado con una suscriptora ocupando
    // cupo, o una segunda invocación viendo un estado a medio camino.
    const invalidState = refreshed?.isActive === false && refreshed.seatsTaken > 0;
    expect(invalidState).toBe(false);
    void results;
  });
});
