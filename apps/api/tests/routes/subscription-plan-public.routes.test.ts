import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Settings } from "../../src/models/settings.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { seedManaged, seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

/**
 * Catálogo público de planes (Milestone 1.7.3). Sin sesión: es lo que el
 * storefront pinta ANTES de que la visitante se registre. Lo que NO puede
 * salir nunca son los contadores de cupo (`seatsTaken`/`maxActiveSeats`) ni
 * los ids del proveedor — mismo criterio que la disponibilidad de productos:
 * una señal (`soldOut`), jamás el número.
 */

const app = buildApp();
const BASE = "/api/v1/subscription-plans";

async function setEnrollment(fields: { enrollmentOpen: boolean; enrollmentClosesAt?: Date }): Promise<void> {
  // `getSettings()` no persiste el singleton (devuelve defaults): sin `upsert`
  // este `updateOne` no escribiría nada sobre una base recién vaciada.
  await Settings.updateOne(
    { _id: "global" },
    {
      $set: {
        "subscriptions.enrollmentOpen": fields.enrollmentOpen,
        ...(fields.enrollmentClosesAt ? { "subscriptions.enrollmentClosesAt": fields.enrollmentClosesAt } : {}),
      },
    },
    { upsert: true },
  );
}

describe("routes/subscription-plans — GET /", () => {
  it("funciona SIN sesión y devuelve solo los campos públicos de cada plan", async () => {
    await seedPlanWithStripeRefs({ name: "Caja Esencia", shortDescription: "Tu ritual mensual", priceCents: 59900 });

    const response = await request(app).get(BASE);

    expect(response.status).toBe(200);
    expect(response.body.data.plans).toHaveLength(1);
    expect(response.body.data.plans[0]).toEqual({
      id: expect.any(String),
      name: "Caja Esencia",
      slug: expect.any(String),
      description: expect.any(String),
      shortDescription: "Tu ritual mensual",
      priceCents: 59900,
      currency: "MXN",
      billingInterval: "month",
      soldOut: false,
    });
  });

  it("NUNCA expone contadores de cupo ni refs del proveedor", async () => {
    await seedPlanWithStripeRefs({ maxActiveSeats: 7 });

    const response = await request(app).get(BASE);
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toMatch(/seatsTaken|maxActiveSeats|provider|price_fake|prod_fake|isActive|missingEditionAlertedFor/);
  });

  it("excluye planes inactivos y planes sin precio en Stripe (no se podrían contratar)", async () => {
    const visible = await seedPlanWithStripeRefs({ name: "Visible" });
    const inactive = await seedPlanWithStripeRefs({ name: "Inactivo" });
    await SubscriptionPlan.updateOne({ _id: inactive._id }, { $set: { isActive: false } });
    const noPrice = await seedPlanWithStripeRefs({ name: "Sin precio" });
    await SubscriptionPlan.updateOne({ _id: noPrice._id }, { $unset: { providerPriceId: 1 } });

    const response = await request(app).get(BASE);

    expect(response.body.data.plans.map((p: { id: string }) => p.id)).toEqual([visible._id.toString()]);
  });

  it("respeta sortOrder (y desempata por antigüedad)", async () => {
    const last = await seedPlanWithStripeRefs({ name: "Último", sortOrder: 20 });
    const first = await seedPlanWithStripeRefs({ name: "Primero", sortOrder: 1 });
    const second = await seedPlanWithStripeRefs({ name: "Segundo", sortOrder: 1 });

    const response = await request(app).get(BASE);

    expect(response.body.data.plans.map((p: { id: string }) => p.id)).toEqual([
      first._id.toString(),
      second._id.toString(),
      last._id.toString(),
    ]);
  });

  it("soldOut es true cuando el plan llegó a su tope de cupo, false mientras quede lugar", async () => {
    const full = await seedPlanWithStripeRefs({ name: "Lleno", maxActiveSeats: 1, sortOrder: 1 });
    await seedManaged({ planId: full._id.toString() });
    await seedPlanWithStripeRefs({ name: "Con lugar", maxActiveSeats: 3, sortOrder: 2 });

    const response = await request(app).get(BASE);

    expect(response.body.data.plans.map((p: { soldOut: boolean }) => p.soldOut)).toEqual([true, false]);
  });

  it("sin planes visibles devuelve una lista vacía (no un error)", async () => {
    const response = await request(app).get(BASE);

    expect(response.status).toBe(200);
    expect(response.body.data.plans).toEqual([]);
  });
});

describe("routes/subscription-plans — enrollment", () => {
  it("por defecto (nunca se abrió la ventana) las inscripciones están cerradas", async () => {
    const response = await request(app).get(BASE);

    expect(response.body.data.enrollment).toEqual({ open: false });
  });

  it("ventana abierta sin fecha de cierre -> open true", async () => {
    await setEnrollment({ enrollmentOpen: true });

    const response = await request(app).get(BASE);

    expect(response.body.data.enrollment).toEqual({ open: true });
  });

  it("ventana abierta con cierre a futuro -> open true y closesAt en ISO", async () => {
    const closesAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await setEnrollment({ enrollmentOpen: true, enrollmentClosesAt: closesAt });

    const response = await request(app).get(BASE);

    expect(response.body.data.enrollment).toEqual({ open: true, closesAt: closesAt.toISOString() });
  });

  it("ventana con cierre YA VENCIDO -> open false aunque enrollmentOpen siga true (mismo criterio que el alta)", async () => {
    await setEnrollment({ enrollmentOpen: true, enrollmentClosesAt: new Date(Date.now() - 60_000) });

    const response = await request(app).get(BASE);

    expect(response.body.data.enrollment.open).toBe(false);
  });
});

describe("routes/subscription-plans — GET /:slug", () => {
  it("devuelve el plan y el estado de las inscripciones, sin sesión", async () => {
    const plan = await seedPlanWithStripeRefs({ name: "Caja Detalle" });
    await setEnrollment({ enrollmentOpen: true });

    const response = await request(app).get(`${BASE}/${plan.slug}`);

    expect(response.status).toBe(200);
    expect(response.body.data.plan).toMatchObject({ id: plan._id.toString(), slug: plan.slug, name: "Caja Detalle" });
    expect(response.body.data.enrollment).toEqual({ open: true });
    expect(JSON.stringify(response.body)).not.toMatch(/seatsTaken|maxActiveSeats|provider/);
  });

  it.each(["inactivo", "sin-precio", "no-existe"])("plan '%s' (no visible o inexistente) -> 404", async (kind) => {
    if (kind === "inactivo") {
      const plan = await seedPlanWithStripeRefs();
      await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { isActive: false } });
      const response = await request(app).get(`${BASE}/${plan.slug}`);
      expect(response.status).toBe(404);
    } else if (kind === "sin-precio") {
      const plan = await seedPlanWithStripeRefs();
      await SubscriptionPlan.updateOne({ _id: plan._id }, { $unset: { providerPriceId: 1 } });
      const response = await request(app).get(`${BASE}/${plan.slug}`);
      expect(response.status).toBe(404);
    } else {
      const response = await request(app).get(`${BASE}/no-existe`);
      expect(response.status).toBe(404);
    }
  });
});
