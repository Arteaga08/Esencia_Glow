import { DEFAULT_SUBSCRIPTION_SETTINGS, SubscriptionStatus, SubscriptionAction } from "@esencia-glow/shared";
import type { StartSubscriptionResult } from "@esencia-glow/shared";
import { logger } from "../config/logger.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { Settings } from "../models/settings.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { isEnrollmentOpen } from "./subscription-enrollment.js";
import { applyStatusTransition, startSubscription } from "./subscription-seat.service.js";
import {
  resolveSubscriptionProvider,
  type ProviderSubscription,
  type SubscriptionProvider,
} from "./subscription-provider.js";
import { recordAudit } from "./audit.service.js";

/** Orquestación del endpoint de alta (Fase 4 de 1.7.2a, §E del plan). */
interface StartSubscriptionInput {
  userId: string;
  planId: string;
}

const SETTINGS_ID = "global";

/** Construye el DTO de la clienta desde el snapshot ya traducido del
 * proveedor. Si falta algo (p. ej. una factura ya pagada sin
 * `confirmation_secret` en la rama replay), es un 502: no hay nada útil que
 * mostrarle a la clienta para confirmar una tarjeta. */
function buildResult(subscription: ProviderSubscription): StartSubscriptionResult {
  if (
    !subscription.clientSecret ||
    subscription.firstChargeCents === undefined ||
    !subscription.currency ||
    !subscription.nextChargeAt
  ) {
    throw new AppError("No pudimos obtener el detalle de pago de la suscripción, contacta a soporte.", 502);
  }
  return {
    clientSecret: subscription.clientSecret,
    firstChargeCents: subscription.firstChargeCents,
    currency: subscription.currency,
    nextChargeAt: subscription.nextChargeAt.toISOString(),
  };
}

/**
 * Persiste los refs de Stripe con un claim sobre `{_id, status: INCOMPLETE}`
 * (§E del plan). Si pierde el claim, es una carrera extremadamente
 * improbable: el webhook adoptó el ref por su cuenta (`locateAccountForEvent`
 * vía el hint de `metadata.accountId`) ANTES de que este persist corriera —
 * en ese caso el ref ya quedó escrito (verificado releyendo AMBOS refs, no
 * solo `providerSubscriptionId`: un `ensureCustomer` nuevo cuyo
 * `providerCustomerId` nunca llegó a persistirse dejaría una re-alta futura
 * creando un segundo Customer en Stripe — hallazgo de code review).
 */
async function persistProviderRefs(
  account: SubscriptionAccountDocument,
  customerRef: string,
  subscription: ProviderSubscription,
): Promise<void> {
  const updated = await SubscriptionAccount.findOneAndUpdate(
    { _id: account._id, status: SubscriptionStatus.INCOMPLETE },
    {
      $set: {
        providerCustomerId: customerRef,
        providerSubscriptionId: subscription.subscriptionRef,
        ...(subscription.currentPeriodStart ? { currentPeriodStart: subscription.currentPeriodStart } : {}),
        ...(subscription.currentPeriodEnd ? { currentPeriodEnd: subscription.currentPeriodEnd } : {}),
      },
    },
    { new: true },
  );
  if (updated) return;

  const refreshed = await SubscriptionAccount.findById(account._id);
  const hasBothRefs =
    refreshed?.providerSubscriptionId === subscription.subscriptionRef &&
    refreshed?.providerCustomerId === customerRef;
  if (hasBothRefs) return;
  throw new AppError("No se pudo confirmar la suscripción, contacta a soporte.", 500);
}

/** Resuelve el Customer de Stripe: reusa `providerCustomerId` si la cuenta
 * ya lo tiene (re-alta, mismo Customer para siempre), o crea uno nuevo. */
async function resolveCustomerRef(
  provider: SubscriptionProvider,
  account: SubscriptionAccountDocument,
  userId: string,
): Promise<string> {
  if (account.providerCustomerId) return account.providerCustomerId;

  const user = await User.findById(userId).select("email firstName lastName").lean();
  if (!user) throw new AppError("Usuaria no encontrada.", 404);

  return provider.ensureCustomer({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    idempotencyKey: `user:${userId}:customer`,
  });
}

/** Compensación si Stripe falla DESPUÉS de reclamar el cupo (§E del plan):
 * nunca deja el error de compensación enmascarar el original — se loguea y
 * se relanza SIEMPRE el error que disparó el catch. No cancela nada en
 * Stripe: con `default_incomplete` la suscripción (si llegó a crearse)
 * muere sola en ~23h, y el `customer.subscription.deleted` resultante ya lo
 * procesa el webhook. */
async function compensateFailedStart(account: SubscriptionAccountDocument): Promise<void> {
  try {
    await applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");
  } catch (compensationError) {
    logger.error(
      { err: compensationError, accountId: account._id.toString() },
      "Fallo la compensación de un alta de suscripción interrumpida",
    );
  }
}

/**
 * El controller ya verificó `resolveSubscriptionProvider()` antes de llamar
 * aquí (mismo criterio que `checkout`/`createOrder`: el guard vive en el
 * controller, este service no lo repite) — de ahí el `!` sobre el resultado.
 */
async function startSubscriptionForUser(input: StartSubscriptionInput): Promise<StartSubscriptionResult> {
  const provider = resolveSubscriptionProvider()!;

  // `isEnrollmentOpen` (módulo puro) pide `Date`, no el `string` ISO del
  // contrato público de `getSettings()` — se lee el subdocumento CRUDO del
  // singleton UNA sola vez (billingAnchorDay incluido, con su default),
  // nunca `getSettings()` aparte para lo mismo (hallazgo de code review: dos
  // lecturas redundantes del mismo documento en el request path).
  const settingsDoc = await Settings.findById(SETTINGS_ID).lean();
  const subscriptionSettings = settingsDoc?.subscriptions;
  const enrollmentWindow = {
    enrollmentOpen: subscriptionSettings?.enrollmentOpen ?? false,
    enrollmentClosesAt: subscriptionSettings?.enrollmentClosesAt,
  };
  if (!isEnrollmentOpen(new Date(), enrollmentWindow)) {
    throw new AppError("Las inscripciones están cerradas por ahora.", 409);
  }
  const billingAnchorDay = subscriptionSettings?.billingAnchorDay ?? DEFAULT_SUBSCRIPTION_SETTINGS.billingAnchorDay;

  const plan = await SubscriptionPlan.findById(input.planId);
  if (!plan || !plan.isActive || !plan.providerPriceId) {
    throw new AppError("Este plan aún no está disponible.", 409);
  }

  // Rama replay (calco de `ensurePaymentIntent`): la respuesta se perdió o
  // el front reintenta, pero Stripe ya tiene la suscripción. Ni el cupo ni
  // Stripe se vuelven a tocar.
  const existingAccount = await SubscriptionAccount.findOne({ userId: input.userId });
  if (
    existingAccount?.status === SubscriptionStatus.INCOMPLETE &&
    existingAccount.providerSubscriptionId
  ) {
    const subscription = await provider.getSubscription(existingAccount.providerSubscriptionId);
    return buildResult(subscription);
  }

  // El cupo es el recurso escaso: se reclama ANTES de tocar Stripe, para que
  // un plan lleno nunca produzca un Customer/Subscription huérfano.
  const account = await startSubscription({ userId: input.userId, planId: input.planId });

  try {
    const customerRef = await resolveCustomerRef(provider, account, input.userId);

    // Discriminador `seatHeldAt` obligatorio (§E del plan): una re-alta
    // reusa el MISMO `_id` de cuenta, así que una key fija replicaría la
    // suscripción VIEJA si la clienta cancela y se re-suscribe dentro de la
    // ventana de 24h de idempotencia de Stripe.
    const subscription = await provider.startSubscription({
      customerRef,
      priceRef: plan.providerPriceId,
      billingAnchorDay,
      metadata: { accountId: account._id.toString(), userId: input.userId, planId: input.planId },
      idempotencyKey: `account:${account._id.toString()}:sub:${account.seatHeldAt!.getTime()}`,
    });
    // Se valida ANTES de persistir/auditar: si la respuesta viene incompleta
    // (defensivo, no debería ocurrir en el golden path), la compensación de
    // abajo debe correr — nunca dejar una cuenta "exitosa" sin nada que
    // mostrarle a la clienta.
    const result = buildResult(subscription);

    await persistProviderRefs(account, customerRef, subscription);
    await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_STARTED, targetId: account._id });

    return result;
  } catch (error) {
    await compensateFailedStart(account);
    throw error;
  }
}

export { startSubscriptionForUser };
export type { StartSubscriptionInput };
