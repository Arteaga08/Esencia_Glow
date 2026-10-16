import { MAX_CARD_FAILED_ATTEMPTS, SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { logger } from "../config/logger.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";
import { recordAccountCardDecline } from "./card-decline-guard.service.js";
import { applyStatusTransition } from "./subscription-seat.service.js";
import type { SubscriptionProvider } from "./subscription-provider.js";

/** Cuántos `eventId` se guardan para el dedupe propio (calco de `card-payment-attempts`). */
const SIGNUP_FAILED_EVENT_IDS_KEEP = 10;

type AbandonSignupAuditAction =
  | SubscriptionAction.SUBSCRIPTION_INCOMPLETE_EXPIRED
  | SubscriptionAction.SUBSCRIPTION_SIGNUP_DECLINES_EXCEEDED;

/**
 * Da de baja un alta que nunca se pagó: anula la factura y cancela la
 * Subscription en Stripe y, solo si eso pasó, `INCOMPLETE -> CANCELED` local.
 * Lo usan el barrendero de altas abandonadas y el tope de rechazos del alta
 * (`recordSignupCardFailure`, abajo; auditoría run-2, hallazgos 8 y 9), así
 * ambos caminos deciden igual.
 *
 * Si Stripe dice que la factura YA está pagada, la cuenta NO se toca (antes
 * quedaba cobrada y cancelada): se marca `signupPaidDetectedAt` para que el
 * barrendero no vuelva a consultar a Stripe y se audita una sola vez. La activa
 * el `invoice.paid`, que Stripe reintenta durante días; si la cuenta sigue
 * `INCOMPLETE` mucho después, esa auditoría es la pista de que el webhook no
 * está llegando.
 *
 * Quien llama ya releyó la cuenta y verificó que sigue `INCOMPLETE` con sus
 * dos refs; el CAS de `applyStatusTransition` cubre la carrera restante (409).
 */
async function abandonSignupStart(
  account: SubscriptionAccountDocument,
  provider: SubscriptionProvider,
  auditAction: AbandonSignupAuditAction,
  now: Date = new Date(),
): Promise<"abandoned" | "already_paid"> {
  const result = await provider.abandonSubscriptionStart({
    subscriptionRef: account.providerSubscriptionId!,
    invoiceRef: account.latestInvoiceId!,
  });

  if (result.outcome === "already_paid") {
    const marked = await SubscriptionAccount.updateOne(
      { _id: account._id, status: SubscriptionStatus.INCOMPLETE, signupPaidDetectedAt: { $exists: false } },
      { $set: { signupPaidDetectedAt: now } },
    );
    if (marked.modifiedCount === 1) {
      await recordAudit({
        action: SubscriptionAction.SUBSCRIPTION_START_PAID_AWAITING_WEBHOOK,
        targetId: account._id,
        metadata: { invoiceRef: account.latestInvoiceId! },
      });
      logger.warn(
        { accountId: account._id.toString(), invoiceRef: account.latestInvoiceId },
        "La factura de alta ya está pagada pero la cuenta sigue INCOMPLETE: se espera el invoice.paid",
      );
    }
    return "already_paid";
  }

  await applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");
  await recordAudit({ action: auditAction, targetId: account._id });
  return "abandoned";
}

interface RecordSignupCardFailureInput {
  account: SubscriptionAccountDocument;
  eventId: string;
  invoiceRef: string;
  provider: SubscriptionProvider | undefined;
}

/**
 * Tope anti card-testing de la factura de alta (auditoría run-2, hallazgo 8):
 * su `client_secret` acepta confirmaciones de tarjeta desde el navegador
 * mientras la cuenta está `INCOMPLETE`, y antes los rechazos se ignoraban.
 * Cada rechazo NUEVO suma al alta y al tope por cuenta de la usuaria (el mismo
 * contador que los pedidos); al llegar a `MAX_CARD_FAILED_ATTEMPTS` el alta se
 * abandona igual que la abandonaría el barrendero.
 *
 * Idempotente por sí mismo: `signupFailedEventIds` con `$ne` en el filtro
 * asegura que una reentrega nunca cuente doble. Solo cuenta si el rechazo es
 * de la factura de alta EN CURSO (`latestInvoiceId`).
 */
async function recordSignupCardFailure(input: RecordSignupCardFailureInput): Promise<void> {
  const updated = await SubscriptionAccount.findOneAndUpdate(
    {
      _id: input.account._id,
      status: SubscriptionStatus.INCOMPLETE,
      latestInvoiceId: input.invoiceRef,
      signupFailedEventIds: { $ne: input.eventId },
    },
    {
      $inc: { signupFailedAttempts: 1 },
      $push: { signupFailedEventIds: { $each: [input.eventId], $slice: -SIGNUP_FAILED_EVENT_IDS_KEEP } },
    },
    { new: true },
  );
  if (updated) await recordAccountCardDecline(updated.userId);

  // Releída sin el claim cuando el evento ya se había contado: igual hay que
  // decidir si el tope ya se alcanzó (y si la cuenta sigue esperando pago).
  const current = updated ?? (await SubscriptionAccount.findById(input.account._id));
  if (
    !current ||
    current.status !== SubscriptionStatus.INCOMPLETE ||
    !current.providerSubscriptionId ||
    current.latestInvoiceId !== input.invoiceRef ||
    (current.signupFailedAttempts ?? 0) < MAX_CARD_FAILED_ATTEMPTS
  ) {
    return;
  }
  if (!input.provider) {
    // Sin Stripe configurado no hay qué anular; el barrendero la libera luego.
    logger.error({ accountId: current._id.toString() }, "Tope de rechazos del alta alcanzado sin proveedor de suscripciones");
    return;
  }
  try {
    await abandonSignupStart(current, input.provider, SubscriptionAction.SUBSCRIPTION_SIGNUP_DECLINES_EXCEEDED);
  } catch (error) {
    // Dos rechazos por encima del tope llegan juntos y los dos intentan dar de
    // baja: el que pierde el CAS de `applyStatusTransition` (409) no es una
    // falla si la cuenta ya salió de `INCOMPLETE`. Sin esto el evento quedaba
    // fallido y Stripe lo reintentaba solo para descubrir lo mismo.
    if (!(error instanceof AppError && error.statusCode === 409)) throw error;
    const reloaded = await SubscriptionAccount.findById(input.account._id).select("status");
    if (reloaded?.status === SubscriptionStatus.INCOMPLETE) throw error;
  }
}

export { abandonSignupStart, recordSignupCardFailure };
