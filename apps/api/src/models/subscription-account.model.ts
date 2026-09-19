import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";
import {
  subscriptionStatusHistoryEntrySchema,
  type SubscriptionStatusHistoryEntryAttrs,
} from "./subscription-status-history.schema.js";

/**
 * Cuenta de suscripción — UN documento por usuaria, para siempre (decisión
 * de diseño de 1.7.1): re-suscribirse reutiliza el mismo documento
 * (`CANCELED -> INCOMPLETE`, ver subscription-state.ts), nunca crea uno
 * nuevo. El índice único `{userId}` es la defensa real contra el doble alta
 * (doble clic, dos pestañas) — resuelta en el motor, nunca con un `findOne`
 * previo.
 *
 * Documento propio ligado por `userId` (nunca un flag en `User` — ver el
 * comentario de cabecera de user.model.ts): nada de esto crece ese modelo.
 *
 * `cancelAtPeriodEnd` modela "activa pero se cancela al fin del ciclo"
 * (decisión 7): NO es un estado nuevo, es `status: ACTIVE` +
 * `cancelAtPeriodEnd: true`. Solo `system` (el webhook de 1.7.2 al cerrar el
 * período) transiciona a `CANCELED` — la clienta nunca lo hace directo.
 *
 * `providerCustomerId`, `providerSubscriptionId` y los campos de período/
 * dunning quedan opcionales: los llena 1.7.2 (Stripe Billing). Sin campo de
 * método de pago: la suscripción es tarjeta por definición (decisión 6 del
 * plan de 1.7.1) — un `paymentMethod` aquí solo podría tener un valor.
 */
interface SubscriptionAccountAttrs {
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  /** Presente ⟺ esta cuenta ocupa un lugar en `SubscriptionPlan.seatsTaken`
   * (ver SEAT_HOLDING_STATUSES en subscription-state.ts). */
  seatHeldAt?: Date;
  cancelAtPeriodEnd: boolean;
  cancelRequestedAt?: Date;
  cancelReason?: string;
  canceledAt?: Date;
  startedAt?: Date;
  statusHistory: SubscriptionStatusHistoryEntryAttrs[];
  // --- reservados para 1.7.2 (Stripe Billing) ---
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  latestInvoiceId?: string;
  pastDueSince?: Date;
  dunningAttempts: number;
  /** Factura a la que pertenece `dunningAttempts` (Milestone 1.7.2b). Stripe
   * cuenta los intentos POR FACTURA (`attempt_count` reinicia en 1 cada
   * ciclo), así que la guarda monotónica del contador solo tiene sentido
   * dentro de la misma factura. Se limpia al cobrar. */
  dunningInvoiceId?: string;
  pausedAt?: Date;
}

type SubscriptionAccountDocument = HydratedDocument<SubscriptionAccountAttrs>;
type SubscriptionAccountModel = Model<SubscriptionAccountAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };
const MAX_SUBSCRIPTION_STATUS_HISTORY = 50;

/** Duplicado a propósito de `boundedArrayValidator` (order.model.ts): es un
 * helper de 5 líneas y el repo ya tolera esta duplicación exacta con
 * `integerValidator` en varios modelos — extraerlo desde este milestone
 * sería ruido ajeno al diff. */
function boundedArrayValidator(max: number) {
  return {
    validator: (arr: unknown[]) => arr.length <= max,
    message: `{PATH} no puede tener más de ${max} entradas`,
  };
}

const subscriptionAccountSchema = new Schema<SubscriptionAccountAttrs, SubscriptionAccountModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.INCOMPLETE,
    },
    seatHeldAt: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, required: true, default: false },
    cancelRequestedAt: { type: Date },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    canceledAt: { type: Date },
    startedAt: { type: Date },
    statusHistory: {
      type: [subscriptionStatusHistoryEntrySchema],
      default: [],
      validate: boundedArrayValidator(MAX_SUBSCRIPTION_STATUS_HISTORY),
    },
    providerCustomerId: { type: String, trim: true },
    providerSubscriptionId: { type: String, trim: true },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    latestInvoiceId: { type: String, trim: true },
    pastDueSince: { type: Date },
    dunningAttempts: { type: Number, required: true, default: 0, min: 0, validate: integerValidator },
    dunningInvoiceId: { type: String, trim: true },
    pausedAt: { type: Date },
  },
  { timestamps: true },
);

subscriptionAccountSchema.index({ userId: 1 }, { unique: true });
subscriptionAccountSchema.index({ planId: 1, status: 1 });
subscriptionAccountSchema.index(
  { providerSubscriptionId: 1 },
  { unique: true, partialFilterExpression: { providerSubscriptionId: { $type: "string" } } },
);
subscriptionAccountSchema.index(
  { providerCustomerId: 1 },
  { unique: true, partialFilterExpression: { providerCustomerId: { $type: "string" } } },
);

const SubscriptionAccount = model<SubscriptionAccountAttrs, SubscriptionAccountModel>(
  "SubscriptionAccount",
  subscriptionAccountSchema,
);

export { SubscriptionAccount, MAX_SUBSCRIPTION_STATUS_HISTORY };
export type { SubscriptionAccountDocument, SubscriptionAccountAttrs };
