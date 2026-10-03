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

  it("annualPriceCents es opcional: un plan sin precio anual es válido", async () => {
    const plan = await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-h" }));
    expect(plan.annualPriceCents).toBeUndefined();
  });

  it("acepta un annualPriceCents entero válido", async () => {
    const plan = await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-i", annualPriceCents: 499000 }));
    expect(plan.annualPriceCents).toBe(499000);
  });

  it("rechaza annualPriceCents no entero", async () => {
    await expect(
      SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-j", annualPriceCents: 1.5 })),
    ).rejects.toThrow();
  });

  it("rechaza annualPriceCents negativo", async () => {
    await expect(
      SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-k", annualPriceCents: -1 })),
    ).rejects.toThrow();
  });

  it("rechaza un providerAnnualPriceId duplicado entre dos planes", async () => {
    await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-l", providerAnnualPriceId: "price_year_123" }));
    await expect(
      SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-m", providerAnnualPriceId: "price_year_123" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("dos planes sin providerAnnualPriceId conviven (el índice parcial no los indexa)", async () => {
    await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-n" }));
    await expect(SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-o" }))).resolves.toBeDefined();
  });

  it("quarterlyPriceCents es opcional y acepta un entero válido", async () => {
    const without = await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q0" }));
    expect(without.quarterlyPriceCents).toBeUndefined();
    const plan = await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q1", quarterlyPriceCents: 146700 }));
    expect(plan.quarterlyPriceCents).toBe(146700);
  });

  it("rechaza quarterlyPriceCents no entero o negativo", async () => {
    await expect(SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q2", quarterlyPriceCents: 1.5 }))).rejects.toThrow();
    await expect(SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q3", quarterlyPriceCents: -1 }))).rejects.toThrow();
  });

  it("rechaza un providerQuarterlyPriceId duplicado entre dos planes", async () => {
    await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q4", providerQuarterlyPriceId: "price_q_123" }));
    await expect(
      SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q5", providerQuarterlyPriceId: "price_q_123" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("dos planes sin providerQuarterlyPriceId conviven", async () => {
    await SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q6" }));
    await expect(SubscriptionPlan.create(buildPlanAttrs({ slug: "plan-q7" }))).resolves.toBeDefined();
  });
});
