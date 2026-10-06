import type { AccountDto } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { getAccount } from "./account-profile.service.js";

/**
 * Datos de facturación: se capturan y se guardan, NO se timbra ninguna factura
 * con ellos. Todo es opcional de punta a punta; el CP fiscal es distinto del de
 * envío. `PUT` reemplaza el bloque completo (no hay merge parcial).
 */

interface BillingInfoInput {
  rfc: string;
  legalName: string;
  cfdiUse?: string | null;
  fiscalRegime?: string | null;
  postalCode: string;
}

async function saveBillingInfo(userId: string, input: BillingInfoInput): Promise<AccountDto> {
  const billingInfo = {
    rfc: input.rfc,
    legalName: input.legalName,
    postalCode: input.postalCode,
    ...(input.cfdiUse ? { cfdiUse: input.cfdiUse } : {}),
    ...(input.fiscalRegime ? { fiscalRegime: input.fiscalRegime } : {}),
  };

  const result = await User.updateOne({ _id: userId }, { $set: { billingInfo } }, { runValidators: true });
  if (result.matchedCount === 0) throw new AppError("No autenticado", 401);
  return getAccount(userId);
}

async function deleteBillingInfo(userId: string): Promise<AccountDto> {
  await User.updateOne({ _id: userId }, { $unset: { billingInfo: 1 } });
  return getAccount(userId);
}

export { saveBillingInfo, deleteBillingInfo };
export type { BillingInfoInput };
