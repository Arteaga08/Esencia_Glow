import { Types } from "mongoose";
import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { recordAudit } from "./audit.service.js";
import { applySystemStatus, recordPaidInvoice, recordPaymentFailure } from "./subscription-billing.service.js";
import { createCycleShipment } from "./subscription-shipment.service.js";
import { sendSubscriptionPaymentConfirmedEmail, sendSubscriptionDunningEmail } from "./subscription-email.service.js";
import { canActorTransition } from "./subscription-state.js";
import type { HandlerOutcome } from "./payment-event-handlers.js";
import type { ProviderSubscriptionStatus, SubscriptionWebhookEvent } from "./subscription-provider.js";

/**
 * Handlers de los 4 eventos de Billing (Fase 3 de 1.7.2a, §D del plan) — el
 * "corazón" del milestone: que un cobro produzca exactamente una caja con su
 * inventario reservado, y que ninguna carrera legítima entre eventos
 * termine en un 500 con reentregas infinitas. Cada handler recibe el evento
 * ya traducido y decide el efecto sobre la cuenta — el orquestador
 * (`payment-webhook.service.ts`) solo despacha y traduce el resultado a
 * `PaymentEvent.status`.
 */

type InvoicePaidEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.invoice_paid" }>;
type PaymentFailedEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.payment_failed" }>;
type SubscriptionUpdatedEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.updated" }>;
type SubscriptionCanceledEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.canceled" }>;

async function flagProviderMismatch(accountId: string): Promise<void> {
  await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_PROVIDER_MISMATCH, targetId: accountId });
}

/**
 * Localiza la cuenta de un evento — calco de `locateOrderForEvent`
 * (payment-event-handlers.ts): primero por `providerSubscriptionId` (índice
 * único), la búsqueda normal del webhook. El hint SOLO localiza, nunca
 * autoriza: si la cuenta del hint ya tiene OTRO ref, es una anomalía real
 * (se audita, nunca se adopta a ciegas). Si no tiene ninguno, el claim
 * atómico es la auto-sanación de "Stripe creó la suscripción pero nuestra
 * escritura del ref se perdió" (Fase 4, endpoint de alta).
 */
async function locateAccountForEvent(
  subscriptionRef: string,
  accountIdHint: string | undefined,
): Promise<SubscriptionAccountDocument | null> {
  const byRef = await SubscriptionAccount.findOne({ providerSubscriptionId: subscriptionRef });
  if (byRef) return byRef;

  if (!accountIdHint || !Types.ObjectId.isValid(accountIdHint)) return null;
  const hinted = await SubscriptionAccount.findById(accountIdHint);
  if (!hinted) return null;

  if (hinted.providerSubscriptionId) {
    if (hinted.providerSubscriptionId !== subscriptionRef) {
      await flagProviderMismatch(hinted._id.toString());
      return null;
    }
    return hinted;
  }

  const adopted = await SubscriptionAccount.findOneAndUpdate(
    { _id: hinted._id, providerSubscriptionId: { $exists: false } },
    { $set: { providerSubscriptionId: subscriptionRef } },
    { new: true },
  );
  // Si el claim pierde (otra entrega ya asignó el ref entre medias), releer
  // por ref es la fuente de verdad — mismo patrón que `locateOrderForEvent`.
  return adopted ?? (await SubscriptionAccount.findOne({ providerSubscriptionId: subscriptionRef }));
}

function mapToInternalStatus(status: ProviderSubscriptionStatus): SubscriptionStatus {
  switch (status) {
    case "incomplete":
      return SubscriptionStatus.INCOMPLETE;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "paused":
      return SubscriptionStatus.PAUSED;
    case "canceled":
      return SubscriptionStatus.CANCELED;
  }
}

/** Comparte alta y renovación (mismo `kind`) y ambos caminos de cancelación
 * (`.updated` con status `canceled` y `.deleted`): idempotente por
 * construcción vía `applySystemStatus`. `PAUSED -> CANCELED` no es
 * expresable desde el webhook (riesgo #5 del plan) — la máquina de 1.7.1
 * solo permite esa arista para `customer`/`admin`, así que aquí es
 * `ignored`, nunca un 409 escalado a excepción. */
async function handleCancellation(
  account: SubscriptionAccountDocument,
  canceledAt: Date,
  reason?: string,
): Promise<HandlerOutcome> {
  if (account.status === SubscriptionStatus.PAUSED) {
    return { status: "ignored" };
  }
  await applySystemStatus(account, SubscriptionStatus.CANCELED, {
    canceledAt,
    ...(reason ? { cancelReason: reason } : {}),
  });
  return { status: "processed", accountId: account._id.toString() };
}

/**
 * `invoice.paid` — alta y renovación son el MISMO `kind`, a propósito (ver
 * docstring de `subscription-provider.ts`): la diferencia se deriva de
 * NUESTRO estado, nunca del evento. `SUBSCRIPTION_RENEWED` solo se audita si
 * la cuenta YA estaba `ACTIVE`/`PAST_DUE` (antes de tocarla, no después) y
 * la caja del ciclo salió `created` — nunca en el primer cobro ni en una
 * reentrega.
 */
async function handleInvoicePaid(event: InvoicePaidEvent): Promise<HandlerOutcome> {
  if (event.billingReason === "other") {
    return { status: "ignored" };
  }

  const account = await locateAccountForEvent(event.subscriptionRef, event.accountIdHint);
  if (!account) return { status: "rejected", reason: "account_not_found" };

  const accountId = account._id.toString();

  if (account.status === SubscriptionStatus.CANCELED) {
    return { status: "rejected", reason: "late_payment", accountId };
  }
  if (account.status === SubscriptionStatus.PAUSED) {
    // Inalcanzable hoy (pausar/reanudar es autoservicio de 1.7.3 y nadie
    // cobra una suscripción pausada de nuestro lado), pero un cobro
    // efectivo sobre una cuenta pausada es una anomalía de negocio que
    // merece triage, no un cargo que se procesa en silencio.
    return { status: "rejected", reason: "paused_account_charged", accountId };
  }

  const wasEntitled =
    account.status === SubscriptionStatus.ACTIVE || account.status === SubscriptionStatus.PAST_DUE;

  await applySystemStatus(account, SubscriptionStatus.ACTIVE);
  await recordPaidInvoice(accountId, {
    invoiceRef: event.invoiceRef,
    periodStart: event.servicePeriodStart,
    periodEnd: event.servicePeriodEnd,
  });

  const shipment = await createCycleShipment({
    accountId: account._id,
    userId: account.userId,
    planId: account.planId,
    invoiceRef: event.invoiceRef,
    servicePeriodStart: event.servicePeriodStart,
  });

  if (wasEntitled && shipment.outcome === "created") {
    await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_RENEWED, targetId: account._id });
  }

  // Confirmación de cada cobro exitoso (decisión 7 del plan) — best-effort,
  // fire-and-forget, con su propia `Idempotency-Key` por `invoiceRef` (nunca
  // bloquea la respuesta al webhook). El período que se muestra es el que
  // `recordPaidInvoice` DEJÓ vigente, no `event.servicePeriodEnd` a ciegas:
  // Stripe no garantiza el orden de entrega, así que una factura VIEJA
  // procesada después de una más nueva no debe anunciarle a la clienta una
  // fecha de vigencia que ya quedó atrás (la guarda monotónica de
  // `recordPaidInvoice` ya rechazó escribirla).
  const currentAccount = await SubscriptionAccount.findById(account._id).select("currentPeriodEnd");
  void sendSubscriptionPaymentConfirmedEmail({
    accountId,
    userId: account.userId,
    invoiceRef: event.invoiceRef,
    amountPaidCents: event.amountPaidCents,
    currency: event.currency,
    periodEnd: currentAccount?.currentPeriodEnd ?? event.servicePeriodEnd,
  });

  return { status: "processed", accountId };
}

/**
 * `invoice.payment_failed` — `INCOMPLETE -> PAST_DUE` no existe en la tabla
 * de transiciones (Stripe expira sola la suscripción incompleta y esa
 * expiración llega por `customer.subscription.deleted`, nunca por un fallo
 * de cobro): cae en `ignored`, nunca lanza. `CANCELED`/`PAUSED` tampoco
 * tienen nada que degradar. `PAST_DUE` sigue sumando `dunningAttempts`
 * aunque `applySystemStatus` sea un no-op (ya está en el destino): el campo
 * es "intentos de la FACTURA en curso", no solo el primer fallo.
 */
async function handlePaymentFailed(event: PaymentFailedEvent): Promise<HandlerOutcome> {
  const account = await locateAccountForEvent(event.subscriptionRef, event.accountIdHint);
  if (!account) return { status: "rejected", reason: "account_not_found" };

  if (account.status !== SubscriptionStatus.ACTIVE && account.status !== SubscriptionStatus.PAST_DUE) {
    return { status: "ignored" };
  }

  const accountId = account._id.toString();
  await applySystemStatus(account, SubscriptionStatus.PAST_DUE);
  await recordPaymentFailure(accountId, event.attemptCount);

  // Dunning a la clienta (decisión 7 del plan) — best-effort, con su propia
  // `Idempotency-Key` por `invoiceRef`+`attemptCount`.
  void sendSubscriptionDunningEmail({
    accountId,
    userId: account.userId,
    invoiceRef: event.invoiceRef,
    attemptCount: event.attemptCount,
  });

  return { status: "processed", accountId };
}

/** Período monotónico, igual que `recordPaidInvoice` pero SIN tocar
 * `invoiceId`/`dunningAttempts`: `customer.subscription.updated` no trae una
 * factura, solo el snapshot de período que Stripe reporta. */
async function updatePeriodIfNewer(accountId: Types.ObjectId, start: Date, end: Date): Promise<void> {
  await SubscriptionAccount.updateOne(
    {
      _id: accountId,
      $or: [{ currentPeriodEnd: { $exists: false } }, { currentPeriodEnd: { $lte: end } }],
    },
    { $set: { currentPeriodStart: start, currentPeriodEnd: end } },
  );
}

/**
 * `customer.subscription.updated` — pre-chequea con `canActorTransition` en
 * vez de `assertTransition`: nunca lanza, cualquier estado no alcanzable por
 * `system` (p. ej. Stripe reporta `paused`, arista exclusiva de
 * `customer`/`admin`) cae en `ignored`, no en un 500 con reintentos
 * infinitos de Stripe.
 */
async function handleSubscriptionUpdated(event: SubscriptionUpdatedEvent): Promise<HandlerOutcome> {
  const account = await locateAccountForEvent(event.subscriptionRef, event.accountIdHint);
  if (!account) return { status: "rejected", reason: "account_not_found" };

  const to = mapToInternalStatus(event.status);

  if (to === SubscriptionStatus.CANCELED) {
    return handleCancellation(account, new Date());
  }

  if (account.status === to) {
    if (event.currentPeriodStart && event.currentPeriodEnd) {
      await updatePeriodIfNewer(account._id, event.currentPeriodStart, event.currentPeriodEnd);
    }
    return { status: "processed", accountId: account._id.toString() };
  }

  if (!canActorTransition(account.status, to, "system")) {
    return { status: "ignored" };
  }

  await applySystemStatus(account, to);
  if (event.currentPeriodStart && event.currentPeriodEnd) {
    await updatePeriodIfNewer(account._id, event.currentPeriodStart, event.currentPeriodEnd);
  }

  return { status: "processed", accountId: account._id.toString() };
}

/** `customer.subscription.deleted` — el otro camino de cancelación, mismo
 * helper que `.updated(canceled)`: `handleSubscriptionCanceled` cierra
 * también `cancelAtPeriodEnd` (la clienta marca la bandera en 1.7.3, Stripe
 * cobra hasta el fin del período y emite este mismo evento). */
async function handleSubscriptionCanceled(event: SubscriptionCanceledEvent): Promise<HandlerOutcome> {
  const account = await locateAccountForEvent(event.subscriptionRef, event.accountIdHint);
  if (!account) return { status: "rejected", reason: "account_not_found" };

  return handleCancellation(account, event.canceledAt, event.reason);
}

export {
  locateAccountForEvent,
  handleInvoicePaid,
  handlePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionCanceled,
};
