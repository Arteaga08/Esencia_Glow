import { describe, expect, it } from "vitest";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";

function buildPlanAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Caja Esencial",
    slug: "caja-esencial",
    description: "Descripción de la caja",
    priceCents: 49900,
    maxActiveSeats: 100,
    ...overrides,
  };
}

describe("models/SubscriptionPlan", () => {
  it("crea un plan válido con los defaults esperados", async () => {
    const plan = await SubscriptionPlan.create(buildPlanAttrs());
    expect(plan.currency).toBe("MXN");
    expect(plan.billingInterval).toBe("month");
    expect(plan.seatsTaken).toBe(0);
    expect(plan.isActive).toBe(true);
  });

  it("rechaza un slug duplicado (11000)", async () => {
    await SubscriptionPlan.create(buildPlanAttrs({ slug: "caja-duplicada" }));
    await expect(
      SubscriptionPlan.create(buildPlanAttrs({ name: "Otra Caja", slug: "caja-duplicada" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rechaza un providerPriceId duplicado entre dos planes", async () => {
    await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-a", providerPriceId: "price_123" }));
    await expect(
      SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-b", providerPriceId: "price_123" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("dos planes sin providerPriceId conviven (el índice parcial no los indexa)", async () => {
    await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-c" }));
    await expect(SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-d" }))).resolves.toBeDefined();
  });

  it("rechaza maxActiveSeats no entero", async () => {
    await expect(SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-e", maxActiveSeats: 1.5 }))).rejects.toThrow();
  });

  it("rechaza maxActiveSeats negativo", async () => {
    await expect(SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-f", maxActiveSeats: -1 }))).rejects.toThrow();
  });

  it("acepta maxActiveSeats: 0 (cierra altas sin desactivar el plan)", async () => {
    const plan = await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-g", maxActiveSeats: 0 }));
    expect(plan.maxActiveSeats).toBe(0);
  });
});
