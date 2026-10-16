import { Types } from "mongoose";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import type { SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import type { SubscriptionWebhookEvent } from "./subscription-provider.js";

type InvoicePaidEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.invoice_paid" }>;

type ChargedPlanSource = "price" | "metadata" | "account" | "account_unresolved";

interface ChargedPlan {
  planId: Types.ObjectId;
  source: ChargedPlanSource;
  /** `true` si hay que avisar al admin: el plan cobrado no es el de la cuenta
   * o el precio de la factura no se pudo ubicar en ningún plan. */
  mismatch: boolean;
}

/**
 * Plan que de verdad se cobró en una factura pagada (auditoría run-2, hallazgo
 * 12). El evento `invoice.paid` no trae el plan, y `account.planId` puede haber
 * cambiado entre el momento en que Stripe fijó el precio de la renovación y el
 * momento en que llega el webhook; la caja y el registro de ingresos deben
 * seguir al plan COBRADO. Orden de evidencia: el precio de la línea (cada plan
 * tiene sus precios mensual/trimestral/anual, únicos por índice) y, si falta, la
 * `metadata.planId` del snapshot. Sin evidencia (factura de alta, fake de
 * pruebas) se conserva el plan de la cuenta sin alarma; con un precio que no
 * corresponde a ningún plan se conserva y SÍ se marca para revisión.
 */
async function resolveChargedPlan(event: InvoicePaidEvent, account: SubscriptionAccountDocument): Promise<ChargedPlan> {
  if (event.priceRef) {
    const byPrice = await SubscriptionPlan.findOne({
      $or: [
        { providerPriceId: event.priceRef },
        { providerQuarterlyPriceId: event.priceRef },
        { providerAnnualPriceId: event.priceRef },
      ],
    })
      .select("_id")
      .lean();
    if (byPrice) {
      return { planId: byPrice._id, source: "price", mismatch: !byPrice._id.equals(account.planId) };
    }
  }

  if (event.planIdHint && Types.ObjectId.isValid(event.planIdHint)) {
    const byHint = await SubscriptionPlan.findById(event.planIdHint).select("_id").lean();
    if (byHint) {
      return { planId: byHint._id, source: "metadata", mismatch: !byHint._id.equals(account.planId) };
    }
  }

  return {
    planId: account.planId,
    source: event.priceRef ? "account_unresolved" : "account",
    mismatch: Boolean(event.priceRef),
  };
}

export { resolveChargedPlan };
export type { ChargedPlan, ChargedPlanSource };
