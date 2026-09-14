import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import {
  createPlan,
  deactivatePlan,
  getPlanById,
  updatePlan,
} from "../../src/services/subscription-plan.service.js";
import { startSubscription } from "../../src/services/subscription-seat.service.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";

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

  it("crea el Product+Price en Stripe ANTES de insertar y persiste ambos refs (Milestone 1.7.2a)", async () => {
    const provider = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(provider);

    const plan = await createPlan(buildInput({ name: "Caja Con Stripe" }));

    expect(provider.createPlanProduct).toHaveBeenCalledTimes(1);
    const [callInput] = vi.mocked(provider.createPlanProduct).mock.calls[0];
    expect(callInput.planSlug).toBe("caja-con-stripe");
    expect(callInput.priceCents).toBe(49900);

    expect(plan.providerProductId).toBe("prod_fake_1");
    expect(plan.providerPriceId).toBe("price_fake_1");
  });

  it("sin proveedor de suscripciones configurado responde 503 y no crea nada", async () => {
    __setSubscriptionProviderForTests(undefined);

    await expect(createPlan(buildInput())).rejects.toMatchObject({ statusCode: 503 });
    expect(await SubscriptionPlan.countDocuments()).toBe(0);
  });

  it("el precio ya NO se puede actualizar vía updatePlan (decisión 1: Price de Stripe inmutable para siempre)", async () => {
    const plan = await createPlan(buildInput());

    // `priceCents` ya no es parte del tipo de entrada — un caller que lo
    // mande de todas formas (p. ej. desde JS sin tipos) debe ser ignorado.
    const updated = await updatePlan(plan._id.toString(), { priceCents: 59900 } as never);
    expect(updated.priceCents).toBe(49900);
  });
});
