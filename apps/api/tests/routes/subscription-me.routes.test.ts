import request from "supertest";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { SubscriptionShipmentStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { buildApp } from "../../src/app.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { createCycleShipment } from "../../src/services/subscription-shipment.service.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import {
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscriptionVariantWithStock,
} from "../helpers/subscription-fixtures.js";
import { startSubscription } from "../../src/services/subscription-seat.service.js";
import { applyStatusTransition } from "../../src/services/subscription-seat.service.js";

/**
 * `GET /subscriptions/me` (Milestone 1.7.2b, Fase 5) — lo que la suscriptora
 * ve de su propia suscripción. Nunca expone refs de Stripe ni el historial
 * interno de estados.
 */

const app = buildApp();
const PERIOD_START = new Date("2026-09-15T12:00:00Z");

describe("routes/subscription — GET /me", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/subscriptions/me");
    expect(response.status).toBe(401);
  });

  it("una usuaria que nunca se suscribió recibe 200 con subscription en null", async () => {
    const { agent } = await createCustomerSession(app);

    const response = await agent.get("/api/v1/subscriptions/me");

    expect(response.status).toBe(200);
    expect(response.body.data.subscription).toBeNull();
  });

  it("devuelve estado, plan, próximo cobro y las cajas de la suscriptora", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
    });

    const account = await startSubscription({ userId, planId: plan._id.toString() });
    await applyStatusTransition(account, SubscriptionStatus.ACTIVE, "system");
    const nextCharge = new Date("2026-10-15T12:00:00Z");
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { currentPeriodEnd: nextCharge, providerSubscriptionId: "sub_secreto", providerCustomerId: "cus_secreto" } },
    );
    await createCycleShipment({
      accountId: account._id,
      userId: new Types.ObjectId(userId),
      planId: plan._id,
      invoiceRef: `in_${new Types.ObjectId().toString()}`,
      servicePeriodStart: PERIOD_START,
    });

    const response = await agent.get("/api/v1/subscriptions/me");

    expect(response.status).toBe(200);
    const { subscription } = response.body.data;
    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription.plan).toMatchObject({ id: plan._id.toString(), name: plan.name, priceCents: plan.priceCents });
    expect(subscription.nextChargeAt).toBe(nextCharge.toISOString());
    expect(subscription.cancelAtPeriodEnd).toBe(false);
    expect(subscription.shipments).toHaveLength(1);
    expect(subscription.shipments[0]).toMatchObject({
      cycleYear: 2026,
      cycleMonth: 9,
      status: SubscriptionShipmentStatus.PENDING,
    });
  });

  it("nunca expone las referencias de Stripe ni el historial de estados", async () => {
    const { agent, userId } = await createCustomerSession(app);
    const plan = await seedPlanWithStripeRefs();
    const account = await startSubscription({ userId, planId: plan._id.toString() });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { providerSubscriptionId: "sub_secreto", providerCustomerId: "cus_secreto" } },
    );

    const response = await agent.get("/api/v1/subscriptions/me");

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("sub_secreto");
    expect(body).not.toContain("cus_secreto");
    expect(body).not.toContain("statusHistory");
  });

  it("solo devuelve las cajas de quien pregunta", async () => {
    const plan = await seedPlanWithStripeRefs();
    const ajena = await createCustomerSession(app);
    const ajenaAccount = await startSubscription({ userId: ajena.userId, planId: plan._id.toString() });
    await createCycleShipment({
      accountId: ajenaAccount._id,
      userId: new Types.ObjectId(ajena.userId),
      planId: plan._id,
      invoiceRef: `in_${new Types.ObjectId().toString()}`,
      servicePeriodStart: PERIOD_START,
    });

    const propia = await createCustomerSession(app);
    await startSubscription({ userId: propia.userId, planId: plan._id.toString() });

    const response = await propia.agent.get("/api/v1/subscriptions/me");

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.shipments).toHaveLength(0);
  });
});
