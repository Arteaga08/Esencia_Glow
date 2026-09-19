import { describe, expect, it } from "vitest";
import { translateStripeEvent } from "../../src/services/stripe-webhook-translator.js";
import { buildStripeInvoiceEvent, buildStripeSubscriptionEvent } from "../helpers/stripe-subscription-fixtures.js";

/**
 * Extensión de `translateStripeEvent` a Billing (Milestone 1.7.2a, §B del
 * plan): 4 tipos nuevos, despachados desde el MISMO punto de entrada que ya
 * traduce los 7 tipos de pagos — el switch exhaustivo de kinds de pago no se
 * toca, solo se antepone la bifurcación de suscripción justo antes del
 * `{kind:"ignored"}` final.
 */
describe("services/stripe-webhook-translator — eventos de suscripción", () => {
  it("invoice.paid -> subscription.invoice_paid, con el período de la LÍNEA (no invoice.period_start/end)", () => {
    const payload = buildStripeInvoiceEvent("invoice.paid", "in_1", {
      subscriptionId: "sub_1",
      accountIdMetadata: "acc_1",
      amountPaid: 59900,
      currency: "mxn",
      billingReason: "subscription_cycle",
      periodStart: 1_700_000_000,
      periodEnd: 1_702_592_000,
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);

    expect(result).toMatchObject({
      kind: "subscription.invoice_paid",
      subscriptionRef: "sub_1",
      invoiceRef: "in_1",
      accountIdHint: "acc_1",
      amountPaidCents: 59900,
      currency: "mxn",
      billingReason: "subscription_cycle",
    });
    expect((result as { servicePeriodStart: Date }).servicePeriodStart).toEqual(new Date(1_700_000_000 * 1000));
    expect((result as { servicePeriodEnd: Date }).servicePeriodEnd).toEqual(new Date(1_702_592_000 * 1000));
  });

  it("invoice.paid con billing_reason distinto de create/cycle -> billingReason 'other'", () => {
    const payload = buildStripeInvoiceEvent("invoice.paid", "in_2", { billingReason: "manual" });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result).toMatchObject({ kind: "subscription.invoice_paid", billingReason: "other" });
  });

  it("invoice.paid con billing_reason subscription_create se distingue de subscription_cycle", () => {
    const payload = buildStripeInvoiceEvent("invoice.paid", "in_3", { billingReason: "subscription_create" });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result).toMatchObject({ kind: "subscription.invoice_paid", billingReason: "subscription_create" });
  });

  it("invoice.paid sin suscripción asociada (factura suelta) -> ignored", () => {
    const payload = buildStripeInvoiceEvent("invoice.paid", "in_4", { subscriptionId: null });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result.kind).toBe("ignored");
  });

  it("invoice.payment_failed -> subscription.payment_failed con attemptCount y nextAttemptAt", () => {
    const payload = buildStripeInvoiceEvent("invoice.payment_failed", "in_5", {
      subscriptionId: "sub_5",
      accountIdMetadata: "acc_5",
      attemptCount: 2,
      nextPaymentAttempt: 1_700_100_000,
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result).toMatchObject({
      kind: "subscription.payment_failed",
      subscriptionRef: "sub_5",
      invoiceRef: "in_5",
      accountIdHint: "acc_5",
      attemptCount: 2,
    });
    expect((result as { nextAttemptAt?: Date }).nextAttemptAt).toEqual(new Date(1_700_100_000 * 1000));
  });

  it("invoice.payment_failed sin próximo intento (retries agotados) -> nextAttemptAt ausente", () => {
    const payload = buildStripeInvoiceEvent("invoice.payment_failed", "in_6", {
      subscriptionId: "sub_6",
      nextPaymentAttempt: null,
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect((result as { nextAttemptAt?: Date }).nextAttemptAt).toBeUndefined();
  });

  it("customer.subscription.updated -> subscription.updated con status/cancelAtPeriodEnd/período, leídos de items.data[0]", () => {
    const payload = buildStripeSubscriptionEvent("customer.subscription.updated", "sub_7", {
      accountIdMetadata: "acc_7",
      status: "past_due",
      cancelAtPeriodEnd: true,
      currentPeriodStart: 1_700_000_000,
      currentPeriodEnd: 1_702_592_000,
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result).toMatchObject({
      kind: "subscription.updated",
      subscriptionRef: "sub_7",
      accountIdHint: "acc_7",
      status: "past_due",
      cancelAtPeriodEnd: true,
    });
    expect((result as { currentPeriodStart?: Date }).currentPeriodStart).toEqual(new Date(1_700_000_000 * 1000));
    expect((result as { currentPeriodEnd?: Date }).currentPeriodEnd).toEqual(new Date(1_702_592_000 * 1000));
  });

  it("customer.subscription.updated con status desconocido -> se mapea a 'incomplete' (cauteloso, nunca lanza)", () => {
    const payload = buildStripeSubscriptionEvent("customer.subscription.updated", "sub_8", {
      status: "un_status_que_stripe_todavia_no_inventa",
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result).toMatchObject({ kind: "subscription.updated", status: "incomplete" });
  });

  it("customer.subscription.updated con status 'trialing' -> 'active', igual que el adapter", () => {
    // `trialing` NO es un status desconocido: es un estado real de Stripe que
    // `stripe-subscription-provider.ts` mapea a `active` (riesgo aceptado 🟡
    // #4 del plan de 1.7.2a). Que el traductor lo mandara al `default` hacía
    // que una suscripción puesta en trial desde el Dashboard intentara
    // `ACTIVE -> INCOMPLETE`, una transición inexistente que el webhook
    // simplemente ignoraba.
    const payload = buildStripeSubscriptionEvent("customer.subscription.updated", "sub_trial", {
      status: "trialing",
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result).toMatchObject({ kind: "subscription.updated", status: "active" });
  });

  it("customer.subscription.deleted -> subscription.canceled con canceledAt y reason", () => {
    const payload = buildStripeSubscriptionEvent("customer.subscription.deleted", "sub_9", {
      accountIdMetadata: "acc_9",
      canceledAt: 1_700_200_000,
      cancellationReason: "cancellation_requested",
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result).toMatchObject({
      kind: "subscription.canceled",
      subscriptionRef: "sub_9",
      accountIdHint: "acc_9",
      reason: "cancellation_requested",
    });
    expect((result as { canceledAt: Date }).canceledAt).toEqual(new Date(1_700_200_000 * 1000));
  });

  it("customer.subscription.deleted sin cancellation_details -> reason ausente", () => {
    const payload = buildStripeSubscriptionEvent("customer.subscription.deleted", "sub_10", {
      canceledAt: 1_700_200_000,
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect((result as { reason?: string }).reason).toBeUndefined();
  });

  it("invoice.payment_action_required NO está suscrito -> ignored (decisión: el 3DS del alta se resuelve en sesión, la renovación ya llega por subscription.updated->past_due)", () => {
    const payload = buildStripeInvoiceEvent("invoice.payment_action_required", "in_11", {
      subscriptionId: "sub_11",
    });
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result.kind).toBe("ignored");
  });

  it("customer.subscription.paused/resumed (1.7.3, nadie puede pausar desde Stripe todavía) -> ignored", () => {
    const payload = buildStripeSubscriptionEvent("customer.subscription.paused", "sub_12");
    const event = JSON.parse(payload);

    const result = translateStripeEvent(event);
    expect(result.kind).toBe("ignored");
  });
});
