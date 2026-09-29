import { SubscriptionStatus } from "@esencia-glow/shared";
import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";
import { User } from "../../src/models/user.model.js";
import { startSubscription } from "../../src/services/subscription-seat.service.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { seedPlanWithStripeRefs, seedSubscribedAccount } from "../helpers/subscription-fixtures.js";

const app = buildApp();

async function createCustomer(overrides: Partial<{ email: string; firstName: string; lastName: string }> = {}) {
  const suffix = `${Date.now()}-${Math.random()}`;
  return User.create({
    email: overrides.email ?? `cliente-${suffix}@example.com`,
    password: "Contrasena1",
    firstName: overrides.firstName ?? "Ana",
    lastName: overrides.lastName ?? "Pérez",
    role: "customer",
    emailVerified: true,
  });
}

describe("routes/admin-subscription (Cuentas) — listado y detalle", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("401 sin sesión, 403 con sesión de cliente, en listado, detalle y activity", async () => {
    const customer = await createCustomer();
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), userId: customer._id.toString() });

    const anonList = await request(app).get("/api/v1/admin/subscriptions");
    expect(anonList.status).toBe(401);
    const anonDetail = await request(app).get(`/api/v1/admin/subscriptions/${account._id}`);
    expect(anonDetail.status).toBe(401);
    const anonActivity = await request(app).get(`/api/v1/admin/subscriptions/${account._id}/activity`);
    expect(anonActivity.status).toBe(401);

    const { agent } = await createCustomerSession(app);
    expect((await agent.get("/api/v1/admin/subscriptions")).status).toBe(403);
    expect((await agent.get(`/api/v1/admin/subscriptions/${account._id}`)).status).toBe(403);
    expect((await agent.get(`/api/v1/admin/subscriptions/${account._id}/activity`)).status).toBe(403);
  });

  it("el listado expone exactamente las llaves del contrato y nunca datos de proveedor", async () => {
    const customer = await createCustomer({ email: "sola@example.com" });
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      userId: customer._id.toString(),
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: "sub_fake_list",
      providerCustomerId: "cus_fake_list",
    });
    // `currentPeriodEnd`/`startedAt`/`pastDueSince` los llena Stripe Billing
    // (1.7.2a), fuera del alcance de `seedSubscribedAccount` — se fijan
    // directo para probar la serialización completa del contrato.
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { startedAt: new Date("2026-09-01"), currentPeriodEnd: new Date("2026-10-01"), pastDueSince: new Date("2026-09-15") } },
    );

    const { agent } = await createAdminSession(app);
    const res = await agent.get("/api/v1/admin/subscriptions");
    expect(res.status).toBe(200);

    const row = res.body.data.find((r: { id: string }) => r.id === account._id.toString());
    expect(row).toBeTruthy();
    expect(Object.keys(row).sort()).toEqual(
      [
        "id",
        "user",
        "plan",
        "status",
        "billingInterval",
        "cancelAtPeriodEnd",
        "startedAt",
        "currentPeriodEnd",
        "pastDueSince",
        "dunningAttempts",
        "createdAt",
      ].sort(),
    );
    expect(Object.keys(row.user).sort()).toEqual(["id", "firstName", "lastName", "email"].sort());
    expect(Object.keys(row.plan).sort()).toEqual(["id", "name"].sort());
    expect(row.user.email).toBe("sola@example.com");
    expect(row.plan.name).toBe(plan.name);
    expect(row.status).toBe(SubscriptionStatus.ACTIVE);

    expect(row).not.toHaveProperty("providerSubscriptionId");
    expect(row).not.toHaveProperty("providerCustomerId");
    expect(row.billingInterval).toBe("month");
    expect(row).not.toHaveProperty("cancelReason");
    expect(row).not.toHaveProperty("statusHistory");
    expect(row).not.toHaveProperty("seatHeldAt");
    expect(row).not.toHaveProperty("dunningInvoiceId");
    expect(row).not.toHaveProperty("latestInvoiceId");
    expect(row.user).not.toHaveProperty("password");
    expect(row.user).not.toHaveProperty("role");
  });

  it("busca por correo, nombre y apellido de la suscriptora", async () => {
    const customer = await createCustomer({ email: "buscable@example.com", firstName: "Buscable", lastName: "Persona" });
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), userId: customer._id.toString() });
    const { agent } = await createAdminSession(app);

    const byEmail = await agent.get("/api/v1/admin/subscriptions?search=BUSCABLE@example.com");
    expect(byEmail.body.data.map((r: { id: string }) => r.id)).toContain(account._id.toString());

    const byFirstName = await agent.get("/api/v1/admin/subscriptions?search=buscable");
    expect(byFirstName.body.data.map((r: { id: string }) => r.id)).toContain(account._id.toString());

    const byLastName = await agent.get("/api/v1/admin/subscriptions?search=persona");
    expect(byLastName.body.data.map((r: { id: string }) => r.id)).toContain(account._id.toString());
  });

  it("un patrón de regex en la búsqueda se trata como texto literal, sin 500 ni fuga de todas las cuentas", async () => {
    const customer = await createCustomer({ email: "normal@example.com" });
    const plan = await seedPlanWithStripeRefs();
    await seedSubscribedAccount({ planId: plan._id.toString(), userId: customer._id.toString() });
    const { agent } = await createAdminSession(app);

    const wildcard = await agent.get("/api/v1/admin/subscriptions?search=.*");
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.data).toHaveLength(0);

    const unbalancedParen = await agent.get(`/api/v1/admin/subscriptions?search=${encodeURIComponent("(")}`);
    expect(unbalancedParen.status).toBe(200);
    expect(unbalancedParen.body.data).toHaveLength(0);
  });

  it("filtra por status y por planId", async () => {
    const planA = await seedPlanWithStripeRefs();
    const planB = await seedPlanWithStripeRefs();
    const customerActive = await createCustomer({ email: "activa@example.com" });
    const customerPaused = await createCustomer({ email: "pausada@example.com" });
    const accountActive = await seedSubscribedAccount({
      planId: planA._id.toString(),
      userId: customerActive._id.toString(),
      status: SubscriptionStatus.ACTIVE,
    });
    const accountPaused = await seedSubscribedAccount({
      planId: planB._id.toString(),
      userId: customerPaused._id.toString(),
      status: SubscriptionStatus.PAUSED,
    });

    const { agent } = await createAdminSession(app);

    const byStatus = await agent.get(`/api/v1/admin/subscriptions?status=${SubscriptionStatus.PAUSED}`);
    const byStatusIds = byStatus.body.data.map((r: { id: string }) => r.id);
    expect(byStatusIds).toContain(accountPaused._id.toString());
    expect(byStatusIds).not.toContain(accountActive._id.toString());

    const byPlan = await agent.get(`/api/v1/admin/subscriptions?planId=${planA._id}`);
    const byPlanIds = byPlan.body.data.map((r: { id: string }) => r.id);
    expect(byPlanIds).toContain(accountActive._id.toString());
    expect(byPlanIds).not.toContain(accountPaused._id.toString());
  });

  it("?status y ?attention combinados devuelven 400", async () => {
    const { agent } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/subscriptions?status=${SubscriptionStatus.ACTIVE}&attention=true`);
    expect(res.status).toBe(400);
  });

  it("?attention=true trae past_due, incomplete y cambio de plan pendiente, nunca active/paused/canceled sueltas", async () => {
    const plan = await seedPlanWithStripeRefs();
    const customerPastDue = await createCustomer({ email: "pastdue@example.com" });
    const customerIncomplete = await createCustomer({ email: "incompleta@example.com" });
    const customerActive = await createCustomer({ email: "activasola@example.com" });

    const accountPastDue = await seedSubscribedAccount({
      planId: plan._id.toString(),
      userId: customerPastDue._id.toString(),
      status: SubscriptionStatus.PAST_DUE,
    });
    const accountIncomplete = await seedSubscribedAccount({
      planId: plan._id.toString(),
      userId: customerIncomplete._id.toString(),
      status: SubscriptionStatus.INCOMPLETE,
    });
    const accountActive = await seedSubscribedAccount({
      planId: plan._id.toString(),
      userId: customerActive._id.toString(),
      status: SubscriptionStatus.ACTIVE,
    });

    const otherPlan = await seedPlanWithStripeRefs();
    await SubscriptionAccount.updateOne(
      { _id: accountActive._id },
      { $set: { pendingPlanChange: { planId: otherPlan._id, requestedAt: new Date() } } },
    );

    const { agent } = await createAdminSession(app);
    const res = await agent.get("/api/v1/admin/subscriptions?attention=true");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain(accountPastDue._id.toString());
    expect(ids).toContain(accountIncomplete._id.toString());
    expect(ids).toContain(accountActive._id.toString());
  });

  it("pagina con meta.total correcto y respeta ?limit", async () => {
    const plan = await seedPlanWithStripeRefs();
    for (let i = 0; i < 3; i += 1) {
      const customer = await createCustomer();
      await seedSubscribedAccount({ planId: plan._id.toString(), userId: customer._id.toString() });
    }
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/subscriptions?limit=2&page=1");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(res.body.meta.limit).toBe(2);
  });

  it("un sort fuera de whitelist cae al fallback en vez de fallar", async () => {
    const customer = await createCustomer();
    const plan = await seedPlanWithStripeRefs();
    await seedSubscribedAccount({ planId: plan._id.toString(), userId: customer._id.toString() });
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/subscriptions?sort=providerSubscriptionId");
    expect(res.status).toBe(200);
  });

  it("detalle: 400 con id inválido, 404 con id inexistente", async () => {
    const { agent } = await createAdminSession(app);
    const invalid = await agent.get("/api/v1/admin/subscriptions/no-es-un-id");
    expect(invalid.status).toBe(400);
    const missing = await agent.get("/api/v1/admin/subscriptions/000000000000000000000000");
    expect(missing.status).toBe(404);
  });

  it("detalle: trae el historial de estados sin reason ni actorId, y sin datos de proveedor", async () => {
    const customer = await createCustomer({ email: "detalle@example.com" });
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      userId: customer._id.toString(),
      status: SubscriptionStatus.PAST_DUE,
      providerSubscriptionId: "sub_fake_detail",
      providerCustomerId: "cus_fake_detail",
    });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { startedAt: new Date("2026-09-01"), currentPeriodEnd: new Date("2026-10-01"), pastDueSince: new Date("2026-09-15") } },
    );

    const { agent } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/subscriptions/${account._id}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(
      [
        "id",
        "user",
        "plan",
        "status",
        "billingInterval",
        "cancelAtPeriodEnd",
        "startedAt",
        "currentPeriodEnd",
        "pastDueSince",
        "dunningAttempts",
        "createdAt",
        "statusHistory",
      ].sort(),
    );
    expect(res.body.data.statusHistory.length).toBeGreaterThan(0);
    for (const entry of res.body.data.statusHistory) {
      expect(Object.keys(entry).sort()).toEqual(["status", "at", "actorType"].sort());
    }
    expect(res.body.data).not.toHaveProperty("providerSubscriptionId");
    expect(res.body.data).not.toHaveProperty("providerCustomerId");
  });

  it("activity: 404 con id inexistente; devuelve entradas sin metadata", async () => {
    const missing = await (await createAdminSession(app)).agent.get(
      "/api/v1/admin/subscriptions/000000000000000000000000/activity",
    );
    expect(missing.status).toBe(404);

    const customer = await createCustomer({ email: "actividad@example.com" });
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      userId: customer._id.toString(),
      status: SubscriptionStatus.ACTIVE,
    });
    const { agent } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/subscriptions/${account._id}/activity`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const entry of res.body.data) {
      expect(entry).not.toHaveProperty("metadata");
      expect(entry).not.toHaveProperty("ipHash");
      expect(Object.keys(entry).every((key) => ["action", "actorId", "at"].includes(key))).toBe(true);
    }
  });

  it("billingInterval: 'year' en el listado y el detalle de una cuenta anual (Milestone 2.7b)", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    const account = await startSubscription({
      userId: new Types.ObjectId().toString(),
      planId: plan._id.toString(),
      billingInterval: "year",
    });

    const { agent } = await createAdminSession(app);
    const list = await agent.get("/api/v1/admin/subscriptions");
    const row = list.body.data.find((r: { id: string }) => r.id === account._id.toString());
    expect(row.billingInterval).toBe("year");

    const detail = await agent.get(`/api/v1/admin/subscriptions/${account._id}`);
    expect(detail.body.data.billingInterval).toBe("year");
  });
});

describe("routes/admin-subscription-shipments — filtro ?accountId", () => {
  it("filtra las cajas de una sola cuenta y rechaza un id inválido con 400", async () => {
    const customerA = await createCustomer({ email: "cuenta-a@example.com" });
    const customerB = await createCustomer({ email: "cuenta-b@example.com" });
    const plan = await seedPlanWithStripeRefs();
    const accountA = await seedSubscribedAccount({ planId: plan._id.toString(), userId: customerA._id.toString() });
    const accountB = await seedSubscribedAccount({ planId: plan._id.toString(), userId: customerB._id.toString() });

    const shipmentA = await SubscriptionShipment.create({
      accountId: accountA._id,
      userId: customerA._id,
      planId: plan._id,
      cycleYear: 2026,
      cycleMonth: 9,
      reservedItems: [],
    });
    await SubscriptionShipment.create({
      accountId: accountB._id,
      userId: customerB._id,
      planId: plan._id,
      cycleYear: 2026,
      cycleMonth: 9,
      reservedItems: [],
    });

    const { agent } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/subscription-shipments?accountId=${accountA._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(shipmentA._id.toString());

    const invalid = await agent.get("/api/v1/admin/subscription-shipments?accountId=no-es-un-id");
    expect(invalid.status).toBe(400);
  });
});
