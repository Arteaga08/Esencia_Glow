import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { buildApp } from "../../src/app.js";
import { AppError } from "../../src/utils/app-error.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import { openEnrollment } from "../../src/services/subscription-enrollment.service.js";
import { updateSubscriptionSettings } from "../../src/services/settings.service.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

const app = buildApp();

/** Calco de la misma función en `subscription-start.service.test.ts` y
 * `admin-subscription-enrollment.routes.test.ts`: un ancla lejos de "hoy"
 * para que abrir la ventana con los defaults nunca choque con
 * `assertWindowClearOfAnchor`. */
function pickSafeAnchorDay(): number {
  const todayDay = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", day: "numeric" })
      .formatToParts(new Date())
      .find((part) => part.type === "day")?.value,
  );
  return todayDay > 1 ? todayDay - 1 : 28;
}

async function openEnrollmentSafely() {
  await updateSubscriptionSettings({ billingAnchorDay: pickSafeAnchorDay() });
  await openEnrollment({});
}

describe("routes/subscription — POST /subscriptions", () => {
  it("401 sin sesión", async () => {
    const res = await request(app).post("/api/v1/subscriptions").send({ planId: "x", termsAccepted: true });
    expect(res.status).toBe(401);
  });

  it("400 sin aceptar términos", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs();
    const { agent } = await createCustomerSession(app);

    const res = await agent
      .post("/api/v1/subscriptions")
      .send({ planId: plan._id.toString(), termsAccepted: false });
    expect(res.status).toBe(400);
  });

  it("golden path: 201 con clientSecret/firstChargeCents/currency/nextChargeAt, cuenta INCOMPLETE con refs", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs();
    const { agent, userId } = await createCustomerSession(app);

    const res = await agent
      .post("/api/v1/subscriptions")
      .send({ planId: plan._id.toString(), termsAccepted: true });

    expect(res.status).toBe(201);
    expect(res.body.data.clientSecret).toEqual(expect.any(String));
    expect(res.body.data.firstChargeCents).toEqual(expect.any(Number));
    expect(res.body.data.currency).toEqual(expect.any(String));
    expect(res.body.data.nextChargeAt).toEqual(expect.any(String));

    const account = await SubscriptionAccount.findOne({ userId });
    expect(account?.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(account?.providerSubscriptionId).toBeDefined();

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);
  });

  it("replay: reintentar con la misma sesión devuelve el mismo clientSecret sin duplicar cuenta ni cupo", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs();
    const { agent, userId } = await createCustomerSession(app);
    const payload = { planId: plan._id.toString(), termsAccepted: true };

    const first = await agent.post("/api/v1/subscriptions").send(payload);
    const second = await agent.post("/api/v1/subscriptions").send(payload);

    expect(second.status).toBe(201);
    expect(second.body.data.clientSecret).toBe(first.body.data.clientSecret);
    expect(await SubscriptionAccount.countDocuments({ userId })).toBe(1);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);
  });

  it("409 con la ventana de inscripciones cerrada, sin tocar cupo", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { agent } = await createCustomerSession(app);

    const res = await agent
      .post("/api/v1/subscriptions")
      .send({ planId: plan._id.toString(), termsAccepted: true });

    expect(res.status).toBe(409);
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("409 con un planId de un plan inexistente", async () => {
    await openEnrollmentSafely();
    const { agent } = await createCustomerSession(app);

    const res = await agent
      .post("/api/v1/subscriptions")
      .send({ planId: "aaaaaaaaaaaaaaaaaaaaaaaa", termsAccepted: true });
    expect(res.status).toBe(409);
  });

  it("503 sin proveedor configurado: seatsTaken queda en 0, ninguna cuenta se crea", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs();
    const { agent, userId } = await createCustomerSession(app);

    __setSubscriptionProviderForTests(undefined);

    const res = await agent
      .post("/api/v1/subscriptions")
      .send({ planId: plan._id.toString(), termsAccepted: true });

    expect(res.status).toBe(503);
    expect(await SubscriptionAccount.countDocuments({ userId })).toBe(0);
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("Stripe falla tras reclamar el cupo -> respuesta de error, cupo liberado", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs();
    const { agent, userId } = await createCustomerSession(app);

    __setSubscriptionProviderForTests(
      buildFakeSubscriptionProvider({
        startSubscription: vi.fn().mockRejectedValue(new AppError("No pudimos comunicarnos con el procesador de pagos.", 502)),
      }),
    );

    const res = await agent
      .post("/api/v1/subscriptions")
      .send({ planId: plan._id.toString(), termsAccepted: true });

    expect(res.status).toBe(502);
    const account = await SubscriptionAccount.findOne({ userId });
    expect(account?.status).toBe(SubscriptionStatus.CANCELED);
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });
});
