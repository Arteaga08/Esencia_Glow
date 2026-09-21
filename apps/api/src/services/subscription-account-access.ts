import { SubscriptionAction } from "@esencia-glow/shared";
import { logger } from "../config/logger.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";

/**
 * Piezas comunes de los servicios de autoservicio de la suscriptora (1.7.3):
 * `subscription-self-service.service.ts`, `subscription-plan-change.service.ts`
 * y `subscription-payment-method.service.ts`. Sin lógica de negocio propia.
 */

async function loadOwnAccount(userId: string): Promise<SubscriptionAccountDocument> {
  const account = await SubscriptionAccount.findOne({ userId });
  if (!account) {
    throw new AppError("No tienes una suscripción.", 404);
  }
  return account;
}

/** Una cuenta que ya pasó por Stripe siempre tiene su ref. Si falta, los
 * datos están corruptos: seguir sería operar a ciegas sobre el proveedor. */
function requireProviderRef(account: SubscriptionAccountDocument): string {
  if (!account.providerSubscriptionId) {
    throw new AppError("No pudimos cargar tu suscripción, contacta a soporte.", 500);
  }
  return account.providerSubscriptionId;
}

/** Variante para las operaciones sobre el Customer (tarjeta): además del ref de
 * la suscripción exige el del customer. Mismo criterio de datos corruptos. */
function requireProviderRefs(account: SubscriptionAccountDocument): { customerRef: string; subscriptionRef: string } {
  const subscriptionRef = requireProviderRef(account);
  if (!account.providerCustomerId) {
    throw new AppError("No pudimos cargar tu suscripción, contacta a soporte.", 500);
  }
  return { customerRef: account.providerCustomerId, subscriptionRef };
}

/**
 * Corre el paso compensatorio de una operación que ya cambió al otro lado.
 * Si la compensación falla, NO tapa el error original de quien la invoca:
 * se loguea y se audita `PROVIDER_MISMATCH` (el rastro que ops necesita para
 * reconciliar a mano), y el llamador relanza su propio error.
 */
async function compensate(
  accountId: SubscriptionAccountDocument["_id"],
  operation: string,
  step: () => Promise<unknown>,
): Promise<void> {
  try {
    await step();
  } catch (compensationError) {
    logger.error({ err: compensationError, accountId: accountId.toString(), operation }, "Fallo la compensación");
    await recordAudit({
      action: SubscriptionAction.SUBSCRIPTION_PROVIDER_MISMATCH,
      targetId: accountId,
      metadata: { operation, reason: "compensation_failed" },
    });
  }
}

export { loadOwnAccount, requireProviderRef, requireProviderRefs, compensate };
