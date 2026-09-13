import mongoose from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";

function buildAccountAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: new mongoose.Types.ObjectId(),
    planId: new mongoose.Types.ObjectId(),
    ...overrides,
  };
}

describe("models/SubscriptionAccount", () => {
  it("crea una cuenta válida con status INCOMPLETE por default", async () => {
    const account = await SubscriptionAccount.create(buildAccountAttrs());
    expect(account.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(account.cancelAtPeriodEnd).toBe(false);
    expect(account.dunningAttempts).toBe(0);
  });

  it("rechaza una segunda cuenta para el mismo userId, sea cual sea su status", async () => {
    const userId = new mongoose.Types.ObjectId();
    await SubscriptionAccount.create(buildAccountAttrs({ userId, status: SubscriptionStatus.CANCELED }));

    await expect(
      SubscriptionAccount.create(buildAccountAttrs({ userId, status: SubscriptionStatus.INCOMPLETE })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rechaza un providerSubscriptionId duplicado entre dos cuentas", async () => {
    await SubscriptionAccount.create(buildAccountAttrs({ providerSubscriptionId: "sub_123" }));
    await expect(
      SubscriptionAccount.create(buildAccountAttrs({ providerSubscriptionId: "sub_123" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("dos cuentas sin providerSubscriptionId conviven", async () => {
    await SubscriptionAccount.create(buildAccountAttrs());
    await expect(SubscriptionAccount.create(buildAccountAttrs())).resolves.toBeDefined();
  });

  it("rechaza un providerCustomerId duplicado entre dos cuentas", async () => {
    await SubscriptionAccount.create(buildAccountAttrs({ providerCustomerId: "cus_123" }));
    await expect(
      SubscriptionAccount.create(buildAccountAttrs({ providerCustomerId: "cus_123" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rechaza un statusHistory con más de 50 entradas", async () => {
    const entry = { status: SubscriptionStatus.ACTIVE, at: new Date(), actorType: "system" as const };
    await expect(
      SubscriptionAccount.create(buildAccountAttrs({ statusHistory: Array(51).fill(entry) })),
    ).rejects.toThrow();
  });

  it("acepta un statusHistory con exactamente 50 entradas", async () => {
    const entry = { status: SubscriptionStatus.ACTIVE, at: new Date(), actorType: "system" as const };
    const account = await SubscriptionAccount.create(buildAccountAttrs({ statusHistory: Array(50).fill(entry) }));
    expect(account.statusHistory).toHaveLength(50);
  });
});
