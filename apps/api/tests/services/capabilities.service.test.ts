import mongoose from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { resolveCapabilities } from "../../src/services/capabilities.service.js";

async function seedAccount(status: SubscriptionStatus) {
  const userId = new mongoose.Types.ObjectId();
  const planId = new mongoose.Types.ObjectId();
  await SubscriptionAccount.create({
    userId,
    planId,
    status,
    cancelAtPeriodEnd: false,
    providerCustomerId: "cus_secret",
    providerSubscriptionId: "sub_secret",
  });
  return { userId: userId.toString(), planId: planId.toString() };
}

describe("services/capabilities — resolveCapabilities", () => {
  it("sin cuenta de suscripción devuelve subscriber: null", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const capabilities = await resolveCapabilities(userId);
    expect(capabilities).toEqual({ subscriber: null });
  });

  it("ACTIVE tiene subscriber poblado, con planId y cancelAtPeriodEnd", async () => {
    const { userId, planId } = await seedAccount(SubscriptionStatus.ACTIVE);
    const capabilities = await resolveCapabilities(userId);
    expect(capabilities.subscriber).toMatchObject({
      status: SubscriptionStatus.ACTIVE,
      planId,
      cancelAtPeriodEnd: false,
    });
  });

  it("PAST_DUE también tiene derechos (Stripe sigue reintentando el cobro)", async () => {
    const { userId } = await seedAccount(SubscriptionStatus.PAST_DUE);
    const capabilities = await resolveCapabilities(userId);
    expect(capabilities.subscriber).not.toBeNull();
    expect(capabilities.subscriber?.status).toBe(SubscriptionStatus.PAST_DUE);
  });

  it("PAUSED no tiene derechos: la clienta decidió no recibir caja este ciclo", async () => {
    const { userId } = await seedAccount(SubscriptionStatus.PAUSED);
    expect(await resolveCapabilities(userId)).toEqual({ subscriber: null });
  });

  it("INCOMPLETE no tiene derechos: aún no se confirmó el primer cobro", async () => {
    const { userId } = await seedAccount(SubscriptionStatus.INCOMPLETE);
    expect(await resolveCapabilities(userId)).toEqual({ subscriber: null });
  });

  it("CANCELED no tiene derechos", async () => {
    const { userId } = await seedAccount(SubscriptionStatus.CANCELED);
    expect(await resolveCapabilities(userId)).toEqual({ subscriber: null });
  });

  it("nunca filtra providerCustomerId ni providerSubscriptionId al payload", async () => {
    const { userId } = await seedAccount(SubscriptionStatus.ACTIVE);
    const capabilities = await resolveCapabilities(userId);
    const serialized = JSON.stringify(capabilities);
    expect(serialized).not.toContain("cus_secret");
    expect(serialized).not.toContain("sub_secret");
  });
});
