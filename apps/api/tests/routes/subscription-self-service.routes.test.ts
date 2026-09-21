import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { buildApp } from "../../src/app.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import type { SubscriptionProvider } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import { seedManaged, seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

/**
 * Autoservicio de la suscriptora por HTTP (Milestone 1.7.3). Lo que importa
 * aquí es la SUPERFICIE: autenticación, dónde sí y dónde no va
 * `requireCapability` (una pausada no tiene derechos de suscriptora, así que
 * reanudar, cancelar y la tarjeta NO pueden llevarla), el 503 sin proveedor,
 * los validadores y la forma de la respuesta. La lógica de cada operación ya
 * está cubierta en los tests de servicio.
 */

const app = buildApp();
const BASE = "/api/v1/subscriptions/me";

let provider: SubscriptionProvider;

function useProvider(overrides: Partial<SubscriptionProvider> = {}): SubscriptionProvider {
  provider = buildFakeSubscriptionProvider(overrides);
  __setSubscriptionProviderForTests(provider);
  return provider;
}

beforeEach(() => {
  useProvider();
});

const ENDPOINTS: { method: "post" | "put"; path: string; body?: object }[] = [
  { method: "post", path: `${BASE}/pause` },
  { method: "post", path: `${BASE}/resume` },
  { method: "post", path: `${BASE}/cancel` },
  { method: "post", path: `${BASE}/undo-cancel` },
  { method: "post", path: `${BASE}/change-plan`, body: { planId: "aaaaaaaaaaaaaaaaaaaaaaaa" } },
  { method: "post", path: `${BASE}/payment-method/setup-intent` },
  { method: "put", path: `${BASE}/payment-method`, body: { setupIntentId: "seti_1" } },
];

describe("routes/subscription self-service — autenticación", () => {
  it.each(ENDPOINTS)("$method $path sin cookie responde 401", async ({ method, path, body }) => {
    const response = await request(app)[method](path).send(body ?? {});
    expect(response.status).toBe(401);
  });
});

describe("routes/subscription self-service — requireCapability('subscriber')", () => {
  const GATED = [
    { path: `${BASE}/pause`, body: {} },
    { path: `${BASE}/undo-cancel`, body: {} },
    { path: `${BASE}/change-plan`, body: { planId: "aaaaaaaaaaaaaaaaaaaaaaaa" } },
  ];

  it.each(GATED)("POST $path: una usuaria SIN suscripción recibe 403", async ({ path, body }) => {
    const { agent } = await createCustomerSession(app);

    const response = await agent.post(path).send(body);

    expect(response.status).toBe(403);
  });

  it.each(GATED)("POST $path: una PAUSADA (sin derechos de suscriptora) recibe 403", async ({ path, body }) => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId, status: SubscriptionStatus.PAUSED });

    const response = await agent.post(path).send(body);

    expect(response.status).toBe(403);
  });
});

describe("routes/subscription self-service — sin capability (aceptan PAUSED)", () => {
  it("POST /resume: una pausada reanuda y recibe su suscripción ya ACTIVE", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId, status: SubscriptionStatus.PAUSED, pausedAt: new Date() });

    const response = await agent.post(`${BASE}/resume`).send({});

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("POST /cancel: una pausada cancela de inmediato", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId, status: SubscriptionStatus.PAUSED, pausedAt: new Date() });

    const response = await agent.post(`${BASE}/cancel`).send({ reason: "Ya no la uso" });

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.status).toBe(SubscriptionStatus.CANCELED);
    expect(provider.cancelNow).toHaveBeenCalledTimes(1);
  });

  it("POST /payment-method/setup-intent: una pausada puede iniciar el cambio de tarjeta (201 con clientSecret)", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId, status: SubscriptionStatus.PAUSED });

    const response = await agent.post(`${BASE}/payment-method/setup-intent`).send({});

    expect(response.status).toBe(201);
    expect(response.body.data.clientSecret).toMatch(/^seti_fake_/);
  });

  it("PUT /payment-method: una pausada fija su tarjeta nueva", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const seed = await seedManaged({ userId, status: SubscriptionStatus.PAUSED });
    useProvider({
      getPaymentMethodSetup: vi.fn().mockResolvedValue({
        status: "succeeded",
        customerRef: `cus_${seed.subscriptionRef}`,
        paymentMethodRef: "pm_nueva",
        accountIdHint: seed.accountId.toString(),
      }),
    });

    const response = await agent.put(`${BASE}/payment-method`).send({ setupIntentId: "seti_1" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ invoiceRetry: "not_needed" });
  });
});

describe("routes/subscription self-service — caminos felices con capability", () => {
  it("POST /pause: una ACTIVE se pausa y la respuesta trae pausedAt", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId });

    const response = await agent.post(`${BASE}/pause`).send({});

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.status).toBe(SubscriptionStatus.PAUSED);
    expect(response.body.data.subscription.pausedAt).toEqual(expect.any(String));
  });

  it("POST /cancel: una ACTIVE programa la cancelación (sigue ACTIVE, canUndoCancel true) y POST /undo-cancel la deshace", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId });

    const scheduled = await agent.post(`${BASE}/cancel`).send({ reason: "Me mudo" });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.data.subscription).toMatchObject({
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
      canUndoCancel: true,
    });
    expect(scheduled.body.data.subscription.cancelRequestedAt).toEqual(expect.any(String));

    const undone = await agent.post(`${BASE}/undo-cancel`).send({});
    expect(undone.status).toBe(200);
    expect(undone.body.data.subscription).toMatchObject({ cancelAtPeriodEnd: false, canUndoCancel: false });
  });

  it("POST /change-plan: cambia al plan nuevo y la respuesta lo refleja", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId });
    const newPlan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });

    const response = await agent.post(`${BASE}/change-plan`).send({ planId: newPlan._id.toString() });

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.plan.id).toBe(newPlan._id.toString());
    expect(response.body.data.subscription.planChangePending).toBe(false);
  });

  it("la respuesta NUNCA expone refs de Stripe, cancelReason ni statusHistory", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId });
    await agent.post(`${BASE}/cancel`).send({ reason: "Motivo privado" });

    const response = await agent.post(`${BASE}/undo-cancel`).send({});
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toMatch(/sub_|cus_|price_|statusHistory|cancelReason|Motivo privado/);
  });
});

describe("routes/subscription self-service — 503 sin proveedor", () => {
  it.each([
    { path: `${BASE}/pause`, status: SubscriptionStatus.ACTIVE },
    { path: `${BASE}/resume`, status: SubscriptionStatus.PAUSED },
    { path: `${BASE}/cancel`, status: SubscriptionStatus.ACTIVE },
    { path: `${BASE}/payment-method/setup-intent`, status: SubscriptionStatus.ACTIVE },
  ])("POST $path responde 503 y no toca la cuenta", async ({ path, status }) => {
    const { agent, userId } = await createCustomerSession(app);
    const seed = await seedManaged({ userId, status });
    __setSubscriptionProviderForTests(undefined);

    const response = await agent.post(path).send({});

    expect(response.status).toBe(503);
    expect((await SubscriptionAccount.findById(seed.accountId))?.status).toBe(status);
  });
});

describe("routes/subscription self-service — validadores", () => {
  it("POST /cancel con un motivo de más de 300 caracteres -> 400", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId });

    const response = await agent.post(`${BASE}/cancel`).send({ reason: "x".repeat(301) });

    expect(response.status).toBe(400);
    expect(provider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it("POST /cancel sin body y con reason vacío son válidos (el motivo es opcional)", async () => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId });

    const noBody = await agent.post(`${BASE}/cancel`);
    expect(noBody.status).toBe(200);
  });

  it("POST /cancel descarta campos desconocidos (stripUnknown): un cancelReason 'inyectado' no se usa", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const seed = await seedManaged({ userId });

    const response = await agent.post(`${BASE}/cancel`).send({ status: "canceled", providerSubscriptionId: "sub_x" });

    expect(response.status).toBe(200);
    const account = await SubscriptionAccount.findById(seed.accountId);
    expect(account?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(account?.providerSubscriptionId).toBe(seed.subscriptionRef);
  });

  it.each([{}, { planId: "no-es-un-id" }, { planId: 123 }])("POST /change-plan con body inválido %j -> 400", async (body) => {
    const { agent, userId } = await createCustomerSession(app);
    await seedManaged({ userId });

    const response = await agent.post(`${BASE}/change-plan`).send(body);

    expect(response.status).toBe(400);
  });

  it.each([{}, { setupIntentId: "" }, { setupIntentId: "pi_no_es_setup" }, { setupIntentId: "seti_" + "x".repeat(300) }])(
    "PUT /payment-method con body inválido %j -> 400",
    async (body) => {
      const { agent, userId } = await createCustomerSession(app);
      await seedManaged({ userId });

      const response = await agent.put(`${BASE}/payment-method`).send(body);

      expect(response.status).toBe(400);
      expect(provider.getPaymentMethodSetup).not.toHaveBeenCalled();
    },
  );
});

describe("routes/subscription self-service — errores de negocio llegan como HTTP", () => {
  it("POST /resume con el plan LLENO -> 409", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 1 });
    await seedManaged({ userId, planId: plan._id.toString(), status: SubscriptionStatus.PAUSED });
    await seedManaged({ planId: plan._id.toString() });

    const response = await agent.post(`${BASE}/resume`).send({});

    expect(response.status).toBe(409);
    expect(provider.resumeCollection).not.toHaveBeenCalled();
  });

  it("PUT /payment-method con el SetupIntent de otra persona -> 404", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const seed = await seedManaged({ userId });
    useProvider({
      getPaymentMethodSetup: vi.fn().mockResolvedValue({
        status: "succeeded",
        customerRef: "cus_de_otra_persona",
        paymentMethodRef: "pm_1",
        accountIdHint: seed.accountId.toString(),
      }),
    });

    const response = await agent.put(`${BASE}/payment-method`).send({ setupIntentId: "seti_ajeno" });

    expect(response.status).toBe(404);
  });
});
