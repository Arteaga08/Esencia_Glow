import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { EditionStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionEdition } from "../../src/models/subscription-edition.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";
import { unpublishEdition } from "../../src/services/subscription-edition-publish.service.js";
import { processPaymentWebhook } from "../../src/services/payment-webhook.service.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import {
  invoicePaidEvent,
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscribedAccount,
  seedSubscriptionVariantWithStock,
  subscriptionCanceledEvent,
  subscriptionUpdatedEvent,
} from "../helpers/subscription-fixtures.js";

/**
 * Concurrencia real del webhook de Billing (Fase 3 de 1.7.2a, §D del plan) —
 * calcada de subscription-seat.concurrency.test.ts: aserciones sobre
 * INVARIANTES, nunca sobre quién ganó. `Promise.allSettled`, nunca
 * `Promise.all`.
 */

const SEPTEMBER_UTC = new Date("2026-09-15T12:00:00Z");
const provider = buildFakePaymentProvider();

describe("subscription-billing / subscription-webhook-handlers — concurrencia real", () => {
  it("5 invoice.paid de la MISMA factura en paralelo -> 1 sola caja, un solo incremento de reserved, cero rechazos", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
    });
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: subscriptionRef,
    });

    const events = Array.from({ length: 5 }, () =>
      invoicePaidEvent({
        subscriptionRef,
        invoiceRef: "in_concurrent",
        servicePeriodStart: SEPTEMBER_UTC,
        servicePeriodEnd: SEPTEMBER_UTC,
      }),
    );

    const results = await Promise.allSettled(events.map((event) => processPaymentWebhook(event, provider)));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(2);
  }, 30_000);

  it("invoice.paid vs. customer.subscription.updated(active) en carrera -> un solo ACTIVE en el historial, AMBOS fulfilled", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.INCOMPLETE,
      providerSubscriptionId: subscriptionRef,
    });

    const invoiceEvent = invoicePaidEvent({
      subscriptionRef,
      billingReason: "subscription_create",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });
    const updatedEvent = subscriptionUpdatedEvent({ subscriptionRef, status: "active" });

    const results = await Promise.allSettled([
      processPaymentWebhook(invoiceEvent, provider),
      processPaymentWebhook(updatedEvent, provider),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.ACTIVE);
    const activeEntries = reloaded!.statusHistory.filter((entry) => entry.status === SubscriptionStatus.ACTIVE);
    expect(activeEntries).toHaveLength(1);

    // INCOMPLETE ya tenía cupo (seatEffect(INCOMPLETE, ACTIVE) === "none"):
    // ninguno de los dos eventos debió reclamar un cupo adicional.
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);
  }, 30_000);

  it("invoice.paid vs. unpublishEdition en carrera -> XOR: o se despublica (editionIncident) o se sella el cobro (unpublish 409), nunca ambas", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    const edition = await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: subscriptionRef,
    });

    const event = invoicePaidEvent({
      subscriptionRef,
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });

    const results = await Promise.allSettled([
      processPaymentWebhook(event, provider),
      unpublishEdition(edition._id.toString()),
    ]);

    // El webhook SIEMPRE resuelve (200 a Stripe) — nunca lanza hacia afuera.
    expect(results[0]!.status).toBe("fulfilled");

    const reloadedEdition = await SubscriptionEdition.findById(edition._id);
    const shipment = await SubscriptionShipment.findOne({ accountId: account._id });

    const sealed = reloadedEdition?.status === EditionStatus.PUBLISHED && !!reloadedEdition.firstBilledAt;
    const unpublished = reloadedEdition?.status === EditionStatus.DRAFT;

    expect(sealed).toBe(!unpublished); // exactamente uno de los dos, nunca ambos ni ninguno

    if (sealed) {
      expect(shipment?.editionId?.toString()).toBe(edition._id.toString());
      expect(shipment?.editionIncident).toBe(false);
      expect(results[1]!.status).toBe("rejected");
    } else {
      expect(shipment?.editionIncident).toBe(true);
      expect(shipment?.editionId).toBeUndefined();
      expect(results[1]!.status).toBe("fulfilled");
    }
  }, 30_000);

  it("2 facturas DISTINTAS del mismo ciclo en paralelo -> 1 sola caja, exactamente 1 auditoría de ciclo duplicado", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: subscriptionRef,
    });

    const eventA = invoicePaidEvent({
      subscriptionRef,
      invoiceRef: "in_race_a",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });
    const eventB = invoicePaidEvent({
      subscriptionRef,
      invoiceRef: "in_race_b",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });

    const results = await Promise.allSettled([
      processPaymentWebhook(eventA, provider),
      processPaymentWebhook(eventB, provider),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(1);
    expect(
      await AuditLog.countDocuments({ action: "subscription_duplicate_cycle_invoice" }),
    ).toBe(1);
  }, 30_000);

  it("N customer.subscription.deleted de la MISMA suscripción en paralelo -> seatsTaken baja exactamente 1, cero 500", async () => {
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: subscriptionRef,
    });

    const events = Array.from({ length: 5 }, () => subscriptionCanceledEvent({ subscriptionRef }));
    const results = await Promise.allSettled(events.map((event) => processPaymentWebhook(event, provider)));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  }, 30_000);
});
