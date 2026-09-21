import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import type { InvoiceRetryOutcome, SetupPaymentMethodResult, UpdatePaymentMethodResult } from "@esencia-glow/shared";
import type { SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";
import { loadOwnAccount, requireProviderRefs } from "./subscription-account-access.js";
import { resolveSubscriptionProvider } from "./subscription-provider.js";

/**
 * Autoservicio de la tarjeta (Milestone 1.7.3). `PAUSED` también puede
 * cambiarla: mientras está pausada no se cobra nada, y es justo cuando una
 * clienta con la tarjeta vencida la arregla antes de reanudar.
 *
 * El controller ya verificó `resolveSubscriptionProvider()` (503) antes de
 * llamar aquí — de ahí el `!`.
 */

const CARD_MANAGEABLE_STATUSES = [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.PAUSED];

async function loadManageableAccount(userId: string): Promise<SubscriptionAccountDocument> {
  const account = await loadOwnAccount(userId);
  if (!CARD_MANAGEABLE_STATUSES.includes(account.status)) {
    throw new AppError("Tu suscripción no permite cambiar la tarjeta en este momento.", 409);
  }
  return account;
}

/** Paso 1: el SetupIntent para que el front confirme la tarjeta en sesión.
 * Nada de esto persiste local: si la clienta abandona, no queda residuo. */
async function createPaymentMethodSetup(userId: string): Promise<SetupPaymentMethodResult> {
  const provider = resolveSubscriptionProvider()!;
  const account = await loadManageableAccount(userId);
  const { customerRef } = requireProviderRefs(account);

  return provider.createPaymentMethodSetup({ customerRef, accountId: account._id.toString() });
}

/**
 * Paso 2: fija la tarjeta ya confirmada. El `setupIntentId` lo manda el
 * CLIENTE, así que se verifica que el intento es de SU customer y de SU
 * cuenta (el `accountId` lo escribimos nosotros en la metadata al crearlo).
 * Cualquier discrepancia de dueño es 404 — nunca un 403 que confirme que ese
 * id existe — y se evalúa ANTES que el estado del intento, por la misma
 * razón.
 *
 * NO hay transición local: si la cuenta estaba `PAST_DUE` y el reintento de
 * la factura funciona, quien la vuelve `ACTIVE` y crea la caja del ciclo es
 * el webhook `invoice.paid` — el único escritor de todo lo que Stripe tiene
 * que confirmar. La factura a reintentar es `dunningInvoiceId` (la que está
 * fallando), NO `latestInvoiceId` (la última PAGADA).
 */
async function confirmPaymentMethod(userId: string, setupIntentId: string): Promise<UpdatePaymentMethodResult> {
  const provider = resolveSubscriptionProvider()!;
  const account = await loadManageableAccount(userId);
  const { customerRef, subscriptionRef } = requireProviderRefs(account);
  const accountId = account._id.toString();

  const setup = await provider.getPaymentMethodSetup(setupIntentId);
  if (setup.customerRef !== customerRef || setup.accountIdHint !== accountId) {
    throw new AppError("Método de pago no encontrado.", 404);
  }
  if (setup.status !== "succeeded") {
    throw new AppError("Tu tarjeta aún no está confirmada.", 409);
  }
  if (!setup.paymentMethodRef) {
    throw new AppError("No pudimos obtener tu tarjeta del procesador de pagos.", 502);
  }
  const paymentMethodRef = setup.paymentMethodRef;

  await provider.setDefaultPaymentMethod({ subscriptionRef, customerRef, paymentMethodRef });

  let invoiceRetry: InvoiceRetryOutcome = "not_needed";
  if (account.status === SubscriptionStatus.PAST_DUE && account.dunningInvoiceId) {
    const retry = await provider.retryInvoicePayment({
      invoiceRef: account.dunningInvoiceId,
      paymentMethodRef,
      idempotencyKey: `account:${accountId}:inv:${account.dunningInvoiceId}:pm:${paymentMethodRef}`,
    });
    invoiceRetry = retry.outcome;
  }

  await recordAudit({
    action: SubscriptionAction.SUBSCRIPTION_PAYMENT_METHOD_UPDATED,
    actorId: userId,
    targetId: account._id,
    metadata: { retry: invoiceRetry },
  });

  return { invoiceRetry };
}

export { createPaymentMethodSetup, confirmPaymentMethod };
