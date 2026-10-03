import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import type { BillingInterval } from "../services/subscription-billing-interval.js";

/**
 * Registro de cada cobro exitoso de suscripción (Milestone 2.9) — hasta
 * ahora `amountPaidCents` solo viajaba en el evento hacia el correo de
 * confirmación (ver `subscription-webhook-handlers.ts`), nunca se guardaba:
 * sin este documento no hay forma de sumar ingresos por suscripción en el
 * tiempo para el Resumen del panel. Se escribe en `invoice.paid`
 * (`recordSubscriptionInvoice`, subscription-billing.service.ts), SOLO en
 * el camino `processed` — nunca en `rejected`/`ignored`, que no representan
 * dinero cobrado de verdad.
 *
 * `invoiceRef` es la MISMA clave de idempotencia que usa
 * `SubscriptionShipment.invoiceId` para el webhook mensual — su índice
 * único es la única defensa contra una reentrega de Stripe duplicando el
 * ingreso: `upsert` sobre este campo, nunca un `findOne` previo.
 *
 * `billingInterval` opcional, mismo precedente que
 * `SubscriptionAccount.billingInterval`: las cuentas mensuales anteriores a
 * 2.7b no lo tienen, se leen como mensuales sin backfill.
 */
interface SubscriptionInvoiceAttrs {
  invoiceRef: string;
  accountId: Types.ObjectId;
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  billingInterval?: BillingInterval;
  amountPaidCents: number;
  currency: string;
  paidAt: Date;
}

type SubscriptionInvoiceDocument = HydratedDocument<SubscriptionInvoiceAttrs>;
type SubscriptionInvoiceModel = Model<SubscriptionInvoiceAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const subscriptionInvoiceSchema = new Schema<SubscriptionInvoiceAttrs, SubscriptionInvoiceModel>(
  {
    invoiceRef: { type: String, required: true, trim: true },
    accountId: { type: Schema.Types.ObjectId, ref: "SubscriptionAccount", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    billingInterval: { type: String, enum: ["month", "quarter", "year"] },
    amountPaidCents: { type: Number, required: true, min: 0, validate: integerValidator },
    currency: { type: String, required: true, trim: true },
    paidAt: { type: Date, required: true },
  },
  { timestamps: true },
);

/** Idempotencia del webhook: una reentrega de `invoice.paid` trae el mismo
 * `invoiceRef` -> E11000 -> upsert no-op. */
subscriptionInvoiceSchema.index({ invoiceRef: 1 }, { unique: true });
/** Serie del Resumen (`overview.service.ts`): agregación por fecha. */
subscriptionInvoiceSchema.index({ paidAt: 1 });

const SubscriptionInvoice = model<SubscriptionInvoiceAttrs, SubscriptionInvoiceModel>(
  "SubscriptionInvoice",
  subscriptionInvoiceSchema,
);

export { SubscriptionInvoice };
export type { SubscriptionInvoiceDocument, SubscriptionInvoiceAttrs };
