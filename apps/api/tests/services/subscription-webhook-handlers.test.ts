import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { MAX_CARD_FAILED_ATTEMPTS, SubscriptionStatus } from "@esencia-glow/shared";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { PaymentEvent } from "../../src/models/payment-event.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionInvoice } from "../../src/models/subscription-invoice.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";
import { User } from "../../src/models/user.model.js";
import { processPaymentWebhook } from "../../src/services/payment-webhook.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import { applyStatusTransition, startSubscription } from "../../src/services/subscription-seat.service.js";
import {
  invoicePaidEvent,
  paymentFailedEvent,
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscribedAccount,
  seedSubscriptionVariantWithStock,
  subscriptionCanceledEvent,
  subscriptionUpdatedEvent,
} from "../helpers/subscription-fixtures.js";

/**
 * `subscription-webhook-handlers.ts` (Fase 3 de 1.7.2a, §D del plan) — vía
 * `processPaymentWebhook`, el mismo punto de entrada que
 * `payment-webhook.service.test.ts`. Aserciones sobre `PaymentEvent` y la
 * base, nunca sobre los handlers directo: es el contrato real que ve
 * Stripe.
 */

const SEPTEMBER_UTC = new Date("2026-09-15T12:00:00Z");
const OCTOBER_UTC = new Date("2026-10-15T12:00:00Z");

const provider = buildFakePaymentProvider();

async function seedActiveAccountWithEdition(cycleYear = 2026, cycleMonth = 9) {
  const plan = await seedPlanWithStripeRefs();
  const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
  await seedPublishedEdition({
    planId: plan._id.toString(),
    cycleYear,
    cycleMonth,
    items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
  });
  const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
  const account = await seedSubscribedAccount({
    planId: plan._id.toString(),
    status: SubscriptionStatus.ACTIVE,
    providerSubscriptionId: subscriptionRef,
  });
  return { plan, product, variantId, account, subscriptionRef };
}

describe("subscription-webhook-handlers — locateAccountForEvent (vía processPaymentWebhook)", () => {
  it("adopta la cuenta por accountIdHint cuando todavía no tiene providerSubscriptionId", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.INCOMPLETE });
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;

    const event = invoicePaidEvent({
      subscriptionRef,
      accountIdHint: account._id.toString(),
      billingReason: "subscription_create",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });

    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.providerSubscriptionId).toBe(subscriptionRef);
    expect(reloaded?.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("hint con un ref DISTINTO al que ya tiene la cuenta: no se adopta, se audita SUBSCRIPTION_PROVIDER_MISMATCH, rejected account_not_found", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();

    const event = invoicePaidEvent({
      subscriptionRef: "sub_otro_completamente_distinto",
      accountIdHint: account._id.toString(),
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });

    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("account_not_found");

    const audit = await AuditLog.findOne({
      action: "subscription_provider_mismatch",
      targetId: account._id,
    });
    expect(audit).not.toBeNull();

    // El ref original de la cuenta no se pisó con el del evento intruso.
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.providerSubscriptionId).toBe(subscriptionRef);
  });

  it("hint inválido (no es un ObjectId) y sin match directo -> rejected account_not_found", async () => {
    const event = invoicePaidEvent({
      subscriptionRef: "sub_sin_cuenta",
      accountIdHint: "no-es-un-object-id",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });

    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("account_not_found");
  });

  it("sin cuenta en absoluto (ningún ref, ningún hint) -> rejected account_not_found", async () => {
    const event = invoicePaidEvent({ servicePeriodStart: SEPTEMBER_UTC, servicePeriodEnd: SEPTEMBER_UTC });

    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("account_not_found");
  });
});

describe("subscription-webhook-handlers — invoice.paid", () => {
  it("primer cobro (INCOMPLETE -> ACTIVE): processed, caja creada, inventario reservado, SIN SUBSCRIPTION_RENEWED", async () => {
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

    const event = invoicePaidEvent({
      subscriptionRef,
      billingReason: "subscription_create",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });
    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.ACTIVE);

    const shipment = await SubscriptionShipment.findOne({ accountId: account._id });
    expect(shipment).not.toBeNull();
    expect(shipment?.reservedItems).toHaveLength(1);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(1);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
    expect(storedEvent?.accountId).toBe(account._id.toString());

    expect(await AuditLog.countDocuments({ action: "subscription_renewed" })).toBe(0);
  });

  it("renovación (ACTIVE -> ACTIVE, segundo ciclo): processed, segunda caja, SUBSCRIPTION_RENEWED auditado", async () => {
    const { plan, account, subscriptionRef } = await seedActiveAccountWithEdition(2026, 9);
    // El seed solo mueve el status a ACTIVE (no pasa por el webhook, no crea
    // caja): la única caja que existirá tras este test es la de octubre.
    // Se publica una edición propia para ese ciclo.
    const october = await seedSubscriptionVariantWithStock({ onHand: 5 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 10,
      items: [{ productId: october.product._id.toString(), variantId: october.variantId.toString(), quantity: 1 }],
    });

    const event = invoicePaidEvent({
      subscriptionRef,
      billingReason: "subscription_cycle",
      servicePeriodStart: OCTOBER_UTC,
      servicePeriodEnd: OCTOBER_UTC,
    });
    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");

    const audit = await AuditLog.findOne({ action: "subscription_renewed", targetId: account._id });
    expect(audit).not.toBeNull();

    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(1);
  });

  it("renovación tras dunning (PAST_DUE -> ACTIVE): recupera la cuenta, SUBSCRIPTION_RENEWED auditado", async () => {
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
      status: SubscriptionStatus.PAST_DUE,
      providerSubscriptionId: subscriptionRef,
    });

    const event = invoicePaidEvent({
      subscriptionRef,
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });
    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(await AuditLog.countDocuments({ action: "subscription_renewed", targetId: account._id })).toBe(1);
  });

  it("cobro sobre cuenta CANCELED -> rejected 'late_payment', sin caja", async () => {
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
      status: SubscriptionStatus.CANCELED,
      providerSubscriptionId: subscriptionRef,
    });

    const event = invoicePaidEvent({
      subscriptionRef,
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    });
    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("failed");
    expect(storedEvent?.error).toBe("late_payment");
    expect(storedEvent?.accountId).toBe(account._id.toString());
    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(0);
  });

  it("billingReason 'other' (factura manual) -> ignored, sin tocar la cuenta", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();

    const event = invoicePaidEvent({
      subscriptionRef,
      billingReason: "other",
      servicePeriodStart: OCTOBER_UTC,
      servicePeriodEnd: OCTOBER_UTC,
    });
    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("ignored");
    // El seed solo mueve el status a ACTIVE, nunca crea una caja: una
    // factura "other" ignorada no debe crear ninguna.
    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(0);
  });

  it("mismo invoiceRef con eventId DISTINTO (reentrega fuera de ventana de dedupe): sigue habiendo 1 sola caja, reserved no se duplica", async () => {
    const { account, subscriptionRef, variantId } = await seedActiveAccountWithEdition();
    // Dos eventos con `eventId` DISTINTO (cada llamada al builder genera uno
    // nuevo) pero el MISMO `invoiceRef` — el dedupe de `PaymentEvent` no los
    // detiene (eventId distinto), así que es `createCycleShipment` quien
    // debe frenar la segunda reserva.
    const shared = {
      subscriptionRef,
      invoiceRef: "in_shared_retry",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
    };

    await processPaymentWebhook(invoicePaidEvent(shared), provider);
    await processPaymentWebhook(invoicePaidEvent(shared), provider);

    expect(await SubscriptionShipment.countDocuments({ accountId: account._id, invoiceId: "in_shared_retry" })).toBe(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(1); // una sola reserva, la segunda entrega no duplicó
  });

  it("processed -> registra SubscriptionInvoice con el monto y la fecha del evento (Milestone 2.9)", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    const paidAt = new Date("2026-09-15T18:00:00.000Z");

    const event = invoicePaidEvent({
      subscriptionRef,
      invoiceRef: "in_overview_1",
      amountPaidCents: 59900,
      currency: "mxn",
      servicePeriodStart: SEPTEMBER_UTC,
      servicePeriodEnd: SEPTEMBER_UTC,
      paidAt,
    });
    await processPaymentWebhook(event, provider);

    const invoice = await SubscriptionInvoice.findOne({ invoiceRef: "in_overview_1" });
    expect(invoice).not.toBeNull();
    expect(invoice?.accountId.toString()).toBe(account._id.toString());
    expect(invoice?.amountPaidCents).toBe(59900);
    expect(invoice?.currency).toBe("mxn");
    expect(invoice?.paidAt).toEqual(paidAt);
  });

  it("rejected (cuenta CANCELED, cobro tardío) -> NO registra SubscriptionInvoice", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { status: SubscriptionStatus.CANCELED } });

    const event = invoicePaidEvent({ subscriptionRef, invoiceRef: "in_rejected_1" });
    await processPaymentWebhook(event, provider);

    expect(await SubscriptionInvoice.findOne({ invoiceRef: "in_rejected_1" })).toBeNull();
  });

  it("ignored (billingReason 'other') -> NO registra SubscriptionInvoice", async () => {
    const { subscriptionRef } = await seedActiveAccountWithEdition();

    const event = invoicePaidEvent({ subscriptionRef, invoiceRef: "in_ignored_1", billingReason: "other" });
    await processPaymentWebhook(event, provider);

    expect(await SubscriptionInvoice.findOne({ invoiceRef: "in_ignored_1" })).toBeNull();
  });
});

/**
 * Auditoría run-2, hallazgo 12: la renovación se cobró al precio del plan A, pero
 * la clienta cambió a B antes de que llegara `invoice.paid`. La caja y el
 * registro de ingresos deben seguir al plan COBRADO, no al `planId` que la cuenta
 * tiene al procesar el webhook.
 */
describe("subscription-webhook-handlers — invoice.paid con cambio de plan en medio (hallazgo 12)", () => {
  async function seedTwoPlansWithEditions() {
    const planA = await seedPlanWithStripeRefs({ priceCents: 59900 });
    const planB = await seedPlanWithStripeRefs({ priceCents: 99900 });
    const itemsA = await seedSubscriptionVariantWithStock({ onHand: 10 });
    const itemsB = await seedSubscriptionVariantWithStock({ onHand: 10 });
    for (const [plan, items] of [
      [planA, itemsA],
      [planB, itemsB],
    ] as const) {
      await seedPublishedEdition({
        planId: plan._id.toString(),
        cycleYear: 2026,
        cycleMonth: 10,
        items: [{ productId: items.product._id.toString(), variantId: items.variantId.toString(), quantity: 1 }],
      });
    }
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: planA._id.toString(),
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: subscriptionRef,
    });
    // `finalizePlanChange` ya movió la cuenta al plan B cuando llega el cobro de A.
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { planId: planB._id } });
    return { planA, planB, itemsA, itemsB, account, subscriptionRef };
  }

  it("la caja y el ingreso salen del plan COBRADO (A), no del actual (B), y se audita la discrepancia", async () => {
    const { planA, planB, itemsA, itemsB, account, subscriptionRef } = await seedTwoPlansWithEditions();

    const event = invoicePaidEvent({
      subscriptionRef,
      billingReason: "subscription_cycle",
      servicePeriodStart: OCTOBER_UTC,
      servicePeriodEnd: OCTOBER_UTC,
      amountPaidCents: 59900,
      priceRef: planA.providerPriceId!,
    });
    await processPaymentWebhook(event, provider);

    expect((await PaymentEvent.findOne({ eventId: event.eventId }))?.status).toBe("processed");
    const shipment = await SubscriptionShipment.findOne({ accountId: account._id });
    expect(shipment?.planId.toString()).toBe(planA._id.toString());
    const invoice = await SubscriptionInvoice.findOne({ invoiceRef: event.invoiceRef });
    expect(invoice?.planId.toString()).toBe(planA._id.toString());
    expect(invoice?.amountPaidCents).toBe(59900);
    expect((await Inventory.findOne({ variantId: itemsB.variantId }))?.reserved).toBe(0);
    expect((await Inventory.findOne({ variantId: itemsA.variantId }))?.reserved).toBe(1);

    const audit = await AuditLog.findOne({ action: "subscription_invoice_plan_mismatch", targetId: account._id });
    expect(audit?.metadata).toMatchObject({
      invoiceRef: event.invoiceRef,
      chargedPlanId: planA._id.toString(),
      accountPlanId: planB._id.toString(),
    });
  });

  it("sin cambio de plan no hay discrepancia: se usa el plan de la cuenta y no se audita nada", async () => {
    const { planA, account, subscriptionRef } = await seedTwoPlansWithEditions();
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { planId: planA._id } });

    await processPaymentWebhook(
      invoicePaidEvent({
        subscriptionRef,
        billingReason: "subscription_cycle",
        servicePeriodStart: OCTOBER_UTC,
        servicePeriodEnd: OCTOBER_UTC,
        priceRef: planA.providerPriceId!,
      }),
      provider,
    );

    expect((await SubscriptionShipment.findOne({ accountId: account._id }))?.planId.toString()).toBe(
      planA._id.toString(),
    );
    expect(await AuditLog.countDocuments({ action: "subscription_invoice_plan_mismatch" })).toBe(0);
  });

  it("un precio que no corresponde a ningún plan cae al plan de la cuenta, pero se audita para revisión", async () => {
    const { planB, account, subscriptionRef } = await seedTwoPlansWithEditions();

    await processPaymentWebhook(
      invoicePaidEvent({
        subscriptionRef,
        billingReason: "subscription_cycle",
        servicePeriodStart: OCTOBER_UTC,
        servicePeriodEnd: OCTOBER_UTC,
        priceRef: "price_desconocido",
      }),
      provider,
    );

    expect((await SubscriptionShipment.findOne({ accountId: account._id }))?.planId.toString()).toBe(
      planB._id.toString(),
    );
    expect(await AuditLog.countDocuments({ action: "subscription_invoice_plan_mismatch" })).toBe(1);
  });
});

describe("subscription-webhook-handlers — invoice.payment_failed", () => {
  it("sobre INCOMPLETE -> ignored, no toca la cuenta", async () => {
    const plan = await seedPlanWithStripeRefs();
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.INCOMPLETE,
      providerSubscriptionId: subscriptionRef,
    });

    const event = paymentFailedEvent({ subscriptionRef, attemptCount: 1 });
    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("ignored");
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(reloaded?.dunningAttempts).toBe(0);
  });

  it("sobre ACTIVE -> PAST_DUE, dunningAttempts sellado", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();

    const event = paymentFailedEvent({ subscriptionRef, attemptCount: 1 });
    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(reloaded?.dunningAttempts).toBe(1);
    expect(reloaded?.pastDueSince).toBeInstanceOf(Date);
  });

  it("un segundo intento fallido sobre una cuenta YA en PAST_DUE sigue sumando dunningAttempts, sin lanzar", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    await processPaymentWebhook(paymentFailedEvent({ subscriptionRef, attemptCount: 1 }), provider);

    const event = paymentFailedEvent({ subscriptionRef, attemptCount: 2 });
    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(reloaded?.dunningAttempts).toBe(2);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
  });
});

describe("subscription-webhook-handlers — customer.subscription.updated", () => {
  it("status: 'active' sobre una cuenta INCOMPLETE -> ignored, NUNCA activa la cuenta (mecanismo de factura manual: sub.status es 'active' desde el día 1 sin importar el pago; solo invoice.paid puede activar)", async () => {
    const plan = await seedPlanWithStripeRefs();
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.INCOMPLETE,
      providerSubscriptionId: subscriptionRef,
    });

    const event = subscriptionUpdatedEvent({ subscriptionRef, status: "active" });
    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("ignored");
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.INCOMPLETE);
  });

  it("status: 'paused' -> ignored, sin 500, la cuenta sigue ACTIVE", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();

    const event = subscriptionUpdatedEvent({ subscriptionRef, status: "paused" });
    await expect(processPaymentWebhook(event, provider)).resolves.toBeUndefined();

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("ignored");
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("un período VIEJO entregado fuera de orden no pisa uno más nuevo ya registrado", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    const newEnd = new Date("2026-11-01T00:00:00Z");
    await processPaymentWebhook(
      subscriptionUpdatedEvent({
        subscriptionRef,
        status: "active",
        currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
        currentPeriodEnd: newEnd,
      }),
      provider,
    );

    await processPaymentWebhook(
      subscriptionUpdatedEvent({
        subscriptionRef,
        status: "active",
        currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
        currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
      }),
      provider,
    );

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.currentPeriodEnd?.getTime()).toBe(newEnd.getTime());
  });

  it("status: 'past_due' sobre una cuenta ACTIVE: aplica la transición (system sí puede)", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();

    const event = subscriptionUpdatedEvent({ subscriptionRef, status: "past_due" });
    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.PAST_DUE);
    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
  });

  it("status: 'canceled' -> cancela la cuenta (mismo camino que .deleted)", async () => {
    const { plan, account, subscriptionRef } = await seedActiveAccountWithEdition();

    const event = subscriptionUpdatedEvent({ subscriptionRef, status: "canceled" });
    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);
  });
});

describe("subscription-webhook-handlers — customer.subscription.deleted (canceled)", () => {
  it("cancela la cuenta y libera el cupo", async () => {
    const { plan, account, subscriptionRef } = await seedActiveAccountWithEdition();

    const event = subscriptionCanceledEvent({ subscriptionRef, reason: "cancellation_requested" });
    await processPaymentWebhook(event, provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect(reloaded?.cancelReason).toBe("cancellation_requested");
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);
  });

  it("dos cancelaciones seguidas de la MISMA suscripción: seatsTaken nunca queda negativo", async () => {
    const { plan, subscriptionRef } = await seedActiveAccountWithEdition();

    await processPaymentWebhook(subscriptionCanceledEvent({ subscriptionRef }), provider);
    await processPaymentWebhook(subscriptionCanceledEvent({ subscriptionRef }), provider);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("cancelación sobre una cuenta PAUSED -> CANCELED sin tocar el cupo (la pausa ya lo había liberado; Dashboard/escritura local fallida convergen aquí)", async () => {
    const plan = await seedPlanWithStripeRefs();
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.PAUSED,
      providerSubscriptionId: subscriptionRef,
    });
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);

    const event = subscriptionCanceledEvent({ subscriptionRef });
    await processPaymentWebhook(event, provider);

    const storedEvent = await PaymentEvent.findOne({ eventId: event.eventId });
    expect(storedEvent?.status).toBe("processed");
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);
  });
});

describe("subscription-webhook-handlers — canceledAt real de Stripe (1.7.3)", () => {
  it(".updated(canceled) sella el canceledAt y el reason DEL EVENTO, no la hora del servidor", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    const endedAt = new Date("2026-08-01T10:00:00Z");

    await processPaymentWebhook(
      subscriptionUpdatedEvent({ subscriptionRef, status: "canceled", canceledAt: endedAt, reason: "payment_failed" }),
      provider,
    );

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect(reloaded?.canceledAt?.getTime()).toBe(endedAt.getTime());
    expect(reloaded?.cancelReason).toBe("payment_failed");
  });

  it("el motivo ESCRITO por la clienta sobrevive a la cancelación de Stripe (el reason del proveedor es un enum, no lo pisa)", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { cancelAtPeriodEnd: true, cancelReason: "Me mudo de ciudad" } },
    );

    await processPaymentWebhook(
      subscriptionCanceledEvent({ subscriptionRef, reason: "cancellation_requested" }),
      provider,
    );

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect(reloaded?.cancelReason).toBe("Me mudo de ciudad");
  });

  it(".updated(canceled) sin canceledAt en el evento cae a la hora del servidor (nunca lanza)", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    const before = Date.now();

    await processPaymentWebhook(subscriptionUpdatedEvent({ subscriptionRef, status: "canceled" }), provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.canceledAt?.getTime()).toBeGreaterThanOrEqual(before);
  });
});

/** Auditoría de divergencia (1.7.3): `.updated` NO sincroniza `cancelAtPeriodEnd`
 * ni la pausa (una reentrega fuera de orden las voltearía) — solo las
 * audita, y solo si la cuenta lleva más de 2 min sin escribirse, para no
 * marcar como divergencia nuestra propia ventana "Stripe primero, local
 * después". */
describe("subscription-webhook-handlers — auditoría de divergencia con Stripe", () => {
  async function ageAccount(accountId: Types.ObjectId, minutes: number): Promise<void> {
    await SubscriptionAccount.collection.updateOne(
      { _id: accountId },
      { $set: { updatedAt: new Date(Date.now() - minutes * 60_000) } },
    );
  }

  async function mismatchFields(accountId: Types.ObjectId): Promise<string[]> {
    const rows = await AuditLog.find({ action: "subscription_provider_mismatch", targetId: accountId }).lean();
    return rows.map((row) => String((row.metadata as { field?: string } | undefined)?.field));
  }

  it("cancelAtPeriodEnd distinto en Stripe -> audita divergencia y NO cambia el flag local", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    await ageAccount(account._id, 10);

    const event = subscriptionUpdatedEvent({ subscriptionRef, cancelAtPeriodEnd: true });
    await processPaymentWebhook(event, provider);

    expect(await mismatchFields(account._id)).toEqual(["cancelAtPeriodEnd"]);
    expect((await SubscriptionAccount.findById(account._id))?.cancelAtPeriodEnd).toBe(false);
  });

  it("la misma divergencia DENTRO de la ventana de 2 min no se audita (es nuestra propia escritura en vuelo)", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();

    await processPaymentWebhook(subscriptionUpdatedEvent({ subscriptionRef, cancelAtPeriodEnd: true }), provider);

    expect(await mismatchFields(account._id)).toEqual([]);
  });

  it("cobranza pausada en Stripe sobre una cuenta ACTIVE -> audita 'collectionPaused'", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    await ageAccount(account._id, 10);

    await processPaymentWebhook(subscriptionUpdatedEvent({ subscriptionRef, collectionPaused: true }), provider);

    expect(await mismatchFields(account._id)).toEqual(["collectionPaused"]);
  });

  it("cuenta PAUSED cuya suscripción en Stripe sigue cobrando -> audita 'collectionPaused'", async () => {
    const plan = await seedPlanWithStripeRefs();
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.PAUSED,
      providerSubscriptionId: subscriptionRef,
    });
    await ageAccount(account._id, 10);

    await processPaymentWebhook(subscriptionUpdatedEvent({ subscriptionRef, collectionPaused: false }), provider);

    expect(await mismatchFields(account._id)).toEqual(["collectionPaused"]);
  });

  it("sin divergencia no se audita nada", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    await ageAccount(account._id, 10);

    await processPaymentWebhook(subscriptionUpdatedEvent({ subscriptionRef }), provider);

    expect(await mismatchFields(account._id)).toEqual([]);
  });
});

/** Un cambio de plan a medias (1.7.3) lo resuelve SOLO el reconciliador, que
 * pregunta a Stripe el precio real. El webhook `.updated` no es evidencia: no
 * trae orden ni versión, y una reentrega vieja con el precio de un plan
 * anterior parecería confirmar un cambio que Stripe todavía no aplicó. */
describe("subscription-webhook-handlers — cambio de plan a medias", () => {
  it(".updated NUNCA finaliza ni toca un cambio de plan pendiente", async () => {
    const { account, plan, subscriptionRef } = await seedActiveAccountWithEdition();
    const newPlan = await seedPlanWithStripeRefs();
    await SubscriptionPlan.updateOne({ _id: newPlan._id }, { $inc: { seatsTaken: 1 } });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { pendingPlanChange: { planId: newPlan._id, requestedAt: new Date() } } },
    );

    await processPaymentWebhook(subscriptionUpdatedEvent({ subscriptionRef }), provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.pendingPlanChange).toBeDefined();
    expect(reloaded?.planId.toString()).toBe(plan._id.toString());
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(1);
    expect((await SubscriptionPlan.findById(newPlan._id))?.seatsTaken).toBe(1);
  });
});

/** Correos del webhook de Billing (Fase 5 de 1.7.2a) — solo verifica QUE se
 * disparen desde el handler correcto con los datos del evento; el copy y
 * las `Idempotency-Key` ya están cubiertos en `subscription-email.service.test.ts`. */
describe("subscription-webhook-handlers — correos", () => {
  async function seedUserFor(account: { userId: Types.ObjectId }): Promise<void> {
    await User.create({
      _id: account.userId,
      email: `${account.userId.toString()}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
  }

  it("invoice.paid procesado -> confirma el cobro a la clienta", async () => {
    const { account } = await seedActiveAccountWithEdition();
    await seedUserFor(account);
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const event = invoicePaidEvent({ subscriptionRef: account.providerSubscriptionId!, amountPaidCents: 59900 });
    await processPaymentWebhook(event, provider);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.subject.toLowerCase()).toContain("cobro");
    expect(fake.calls[0]!.idempotencyKey).toBe(`subscription-${account._id.toString()}-invoice-${event.invoiceRef}`);
  });

  it("invoice.paid sobre una cuenta ANUAL -> el correo usa el copy anual (Milestone 2.7b)", async () => {
    const { account } = await seedActiveAccountWithEdition();
    await seedUserFor(account);
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { billingInterval: "year" } });
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const event = invoicePaidEvent({ subscriptionRef: account.providerSubscriptionId!, amountPaidCents: 599000 });
    await processPaymentWebhook(event, provider);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.html).toMatch(/12 cajas|todo el año|ciclo anual/i);
  });

  it("invoice.paid fuera de orden (factura VIEJA procesada DESPUÉS de una más nueva) -> el correo muestra el período vigente real, no el de la factura vieja", async () => {
    const { account } = await seedActiveAccountWithEdition();
    await seedUserFor(account);
    const octoberEnd = new Date("2026-10-15T12:00:00Z");
    const novemberEnd = new Date("2026-11-15T12:00:00Z");

    // Llega primero la factura MÁS NUEVA (noviembre) — deja currentPeriodEnd
    // en noviembre. `recordPaidInvoice` es monotónico: la guarda rechaza
    // pisarlo con algo más viejo.
    await processPaymentWebhook(
      invoicePaidEvent({
        subscriptionRef: account.providerSubscriptionId!,
        invoiceRef: "in_november",
        servicePeriodStart: octoberEnd,
        servicePeriodEnd: novemberEnd,
      }),
      provider,
    );

    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    // Reentrega tardía de la factura VIEJA (octubre) — sigue siendo
    // `processed` (un evento nuevo, `eventId` distinto), pero NO debe
    // pisar el período ni mostrarle a la clienta una fecha de vigencia ya
    // superada.
    await processPaymentWebhook(
      invoicePaidEvent({
        subscriptionRef: account.providerSubscriptionId!,
        invoiceRef: "in_october_late",
        servicePeriodStart: SEPTEMBER_UTC,
        servicePeriodEnd: octoberEnd,
      }),
      provider,
    );

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.currentPeriodEnd?.toISOString()).toBe(novemberEnd.toISOString());

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.html).toContain("15 de noviembre de 2026");
    expect(fake.calls[0]!.html).not.toContain("15 de octubre de 2026");
  });

  it("invoice.payment_failed procesado -> envía dunning a la clienta", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    await seedUserFor(account);
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const event = paymentFailedEvent({ subscriptionRef, attemptCount: 1 });
    await processPaymentWebhook(event, provider);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.subject.toLowerCase()).toContain("pago");
    expect(fake.calls[0]!.idempotencyKey).toBe(
      `subscription-${account._id.toString()}-dunning-${event.invoiceRef}-1`,
    );
  });

  it("invoice.payment_failed IGNORADO (sobre INCOMPLETE) -> no envía dunning", async () => {
    const plan = await seedPlanWithStripeRefs();
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.INCOMPLETE,
      providerSubscriptionId: subscriptionRef,
    });
    await seedUserFor(account);
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await processPaymentWebhook(paymentFailedEvent({ subscriptionRef, attemptCount: 1 }), provider);

    expect(fake.calls).toHaveLength(0);
  });
});

describe("subscription-webhook-handlers — cancelAtPeriodEnd al cancelar", () => {
  it("apaga cancelAtPeriodEnd al cancelar: una re-alta reusa el MISMO documento y no debe heredar la bandera", async () => {
    const { account, subscriptionRef } = await seedActiveAccountWithEdition();
    // En 1.7.3 la marca la clienta; aquí se siembra directo porque el
    // endpoint de autoservicio todavía no existe.
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { cancelAtPeriodEnd: true } });

    await processPaymentWebhook(subscriptionCanceledEvent({ subscriptionRef }), provider);

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect(reloaded?.cancelAtPeriodEnd).toBe(false);
  });
});

describe("subscription-webhook-handlers — rechazos de la factura de alta (auditoría run-2, hallazgo 8)", () => {
  async function seedSignupAwaitingCard() {
    const plan = await seedPlanWithStripeRefs();
    const subscriptionRef = `sub_${new Types.ObjectId().toString()}`;
    const invoiceRef = `in_${new Types.ObjectId().toString()}`;
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      status: SubscriptionStatus.INCOMPLETE,
      providerSubscriptionId: subscriptionRef,
    });
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: { latestInvoiceId: invoiceRef } });
    await User.create({
      _id: account.userId,
      email: `${account.userId.toString()}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    return { plan, account, subscriptionRef, invoiceRef };
  }

  it(`al ${MAX_CARD_FAILED_ATTEMPTS}.º rechazo distinto se abandona el alta: Stripe la da de baja, la cuenta queda CANCELED y se audita`, async () => {
    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);
    const { plan, account, subscriptionRef, invoiceRef } = await seedSignupAwaitingCard();

    for (let i = 0; i < MAX_CARD_FAILED_ATTEMPTS - 1; i += 1) {
      await processPaymentWebhook(paymentFailedEvent({ subscriptionRef, invoiceRef, attemptCount: i + 1 }), provider);
    }
    const midway = await SubscriptionAccount.findById(account._id);
    expect(midway?.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(midway?.signupFailedAttempts).toBe(MAX_CARD_FAILED_ATTEMPTS - 1);
    expect(fake.abandonSubscriptionStart).not.toHaveBeenCalled();

    const last = paymentFailedEvent({ subscriptionRef, invoiceRef, attemptCount: MAX_CARD_FAILED_ATTEMPTS });
    await processPaymentWebhook(last, provider);

    expect(fake.abandonSubscriptionStart).toHaveBeenCalledWith({ subscriptionRef, invoiceRef });
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);
    expect((await PaymentEvent.findOne({ eventId: last.eventId }))?.status).toBe("processed");
    expect(
      await AuditLog.countDocuments({ action: "subscription_signup_declines_exceeded", targetId: account._id }),
    ).toBe(1);
  });

  it("el mismo eventId reprocesado no cuenta dos veces", async () => {
    const { account, subscriptionRef, invoiceRef } = await seedSignupAwaitingCard();
    const event = paymentFailedEvent({ subscriptionRef, invoiceRef });

    for (let i = 0; i < 3; i += 1) {
      await processPaymentWebhook(event, provider);
    }

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.signupFailedAttempts).toBe(1);
  });

  it("un rechazo de OTRA factura sobre la cuenta INCOMPLETE sigue en ignored", async () => {
    const { account, subscriptionRef } = await seedSignupAwaitingCard();
    const event = paymentFailedEvent({ subscriptionRef, invoiceRef: "in_otra_factura" });

    await processPaymentWebhook(event, provider);

    expect((await PaymentEvent.findOne({ eventId: event.eventId }))?.status).toBe("ignored");
    expect((await SubscriptionAccount.findById(account._id))?.signupFailedAttempts).toBeUndefined();
  });

  it("cada rechazo del alta suma al tope por cuenta de la usuaria (contador compartido con los pedidos)", async () => {
    const { account, subscriptionRef, invoiceRef } = await seedSignupAwaitingCard();

    await processPaymentWebhook(paymentFailedEvent({ subscriptionRef, invoiceRef }), provider);
    await processPaymentWebhook(paymentFailedEvent({ subscriptionRef, invoiceRef }), provider);

    const user = await User.findById(account.userId).select("+cardDeclineWindow").lean();
    expect(user?.cardDeclineWindow?.count).toBe(2);
  });

  it("una re-alta arranca su factura nueva con el contador en cero", async () => {
    const { plan, account, subscriptionRef, invoiceRef } = await seedSignupAwaitingCard();
    await processPaymentWebhook(paymentFailedEvent({ subscriptionRef, invoiceRef }), provider);
    await applyStatusTransition(
      (await SubscriptionAccount.findById(account._id))!,
      SubscriptionStatus.CANCELED,
      "system",
    );

    const restarted = await startSubscription({ userId: account.userId.toString(), planId: plan._id.toString() });

    expect(restarted.signupFailedAttempts).toBeUndefined();
    expect(restarted.signupFailedEventIds ?? []).toHaveLength(0);
  });

  it("🔀 el 5.º y el 6.º rechazo llegan juntos: el alta se abandona una vez y ningún evento queda fallido", async () => {
    const { account, subscriptionRef, invoiceRef } = await seedSignupAwaitingCard();
    for (let i = 0; i < MAX_CARD_FAILED_ATTEMPTS - 1; i += 1) {
      await processPaymentWebhook(paymentFailedEvent({ subscriptionRef, invoiceRef }), provider);
    }

    const racing = [paymentFailedEvent({ subscriptionRef, invoiceRef }), paymentFailedEvent({ subscriptionRef, invoiceRef })];
    await Promise.allSettled(racing.map((event) => processPaymentWebhook(event, provider)));

    expect((await SubscriptionAccount.findById(account._id))?.status).toBe(SubscriptionStatus.CANCELED);
    const statuses = await PaymentEvent.find({ eventId: { $in: racing.map((event) => event.eventId) } }).distinct("status");
    expect(statuses).toEqual(["processed"]);
    expect(
      await AuditLog.countDocuments({ action: "subscription_signup_declines_exceeded", targetId: account._id }),
    ).toBe(1);
  });

  it("si al llegar al tope la factura ya está pagada, la cuenta sigue INCOMPLETE esperando el invoice.paid", async () => {
    const fake = buildFakeSubscriptionProvider({
      abandonSubscriptionStart: vi.fn().mockResolvedValue({ outcome: "already_paid" }),
    });
    __setSubscriptionProviderForTests(fake);
    const { account, subscriptionRef, invoiceRef } = await seedSignupAwaitingCard();

    let last = paymentFailedEvent({ subscriptionRef, invoiceRef });
    for (let i = 0; i < MAX_CARD_FAILED_ATTEMPTS; i += 1) {
      last = paymentFailedEvent({ subscriptionRef, invoiceRef });
      await processPaymentWebhook(last, provider);
    }

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(reloaded?.signupPaidDetectedAt).toBeInstanceOf(Date);
    expect((await PaymentEvent.findOne({ eventId: last.eventId }))?.status).toBe("processed");
  });
});
