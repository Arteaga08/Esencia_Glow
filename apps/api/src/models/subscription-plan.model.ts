import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { CATALOG_CURRENCY } from "@esencia-glow/shared";

/**
 * Plan de la caja recurrente curada (Milestone 1.7.1). Precio fijo por
 * plan — no varía por edición (decisión 5 del plan de 1.7). `maxActiveSeats`
 * es el cupo de suscriptoras activas (decisión 2); `seatsTaken` es el
 * contador denormalizado que decide en el mismo `findOneAndUpdate` que lo
 * incrementa (ver subscription-seat.service.ts) — mismo patrón que
 * `Inventory.onHand/reserved`, nunca un `countDocuments` (read-then-write).
 *
 * `providerProductId`/`providerPriceId` quedan opcionales: 1.7.1 no habla
 * con Stripe todavía — los llena el alta de 1.7.2.
 */
interface SubscriptionPlanAttrs {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  priceCents: number;
  currency: string;
  billingInterval: "month";
  maxActiveSeats: number;
  seatsTaken: number;
  isActive: boolean;
  sortOrder: number;
  providerProductId?: string;
  providerPriceId?: string;
  /** Último ciclo (`"YYYY-MM"`) por el que el job preventivo ya avisó que
   * falta la edición (Milestone 1.7.2b). Un solo campo en vez de una
   * colección de avisos: solo importa el ciclo en curso, y reescribirlo al
   * pasar al siguiente mes es exactamente el comportamiento deseado. */
  missingEditionAlertedFor?: string;
}

type SubscriptionPlanDocument = HydratedDocument<SubscriptionPlanAttrs>;
type SubscriptionPlanModel = Model<SubscriptionPlanAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const subscriptionPlanSchema = new Schema<SubscriptionPlanAttrs, SubscriptionPlanModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, maxlength: 2000 },
    shortDescription: { type: String, trim: true, maxlength: 300 },
    priceCents: { type: Number, required: true, min: 0, validate: integerValidator },
    currency: { type: String, required: true, default: CATALOG_CURRENCY },
    // Enum de un solo valor a propósito, mismo precedente que
    // `provider: { enum: ["stripe"] }` en order.model.ts: hace la suposición
    // explícita y greppable en vez de implícita — el día que exista un
    // segundo intervalo de facturación, este campo ya está listo.
    billingInterval: { type: String, required: true, enum: ["month"], default: "month" },
    // `min: 0`, no `min: 1`: poner 0 cierra altas nuevas sin desactivar el
    // plan ni afectar a las suscriptoras vigentes — el `$expr` del claim de
    // cupo lo bloquea solo (ver subscription-seat.service.ts).
    maxActiveSeats: { type: Number, required: true, min: 0, validate: integerValidator },
    seatsTaken: { type: Number, required: true, default: 0, min: 0, validate: integerValidator },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    providerProductId: { type: String, trim: true },
    providerPriceId: { type: String, trim: true },
    missingEditionAlertedFor: { type: String, trim: true },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

/**
 * Dos planes no pueden mapear al mismo Price de Stripe: si lo hicieran, el
 * webhook de 1.7.2 no podría resolver a qué plan pertenece una suscripción.
 * Parcial y NO `sparse`, por el mismo motivo documentado en el índice de
 * `payment.intentId` en order.model.ts: un `sparse` compuesto indexaría
 * cualquier documento donde CUALQUIER campo del índice exista, y aquí es de
 * un solo campo, pero mantener el criterio explícito (`$type: "string"`)
 * dice con precisión qué se está excluyendo.
 */
subscriptionPlanSchema.index(
  { providerPriceId: 1 },
  { unique: true, partialFilterExpression: { providerPriceId: { $type: "string" } } },
);

const SubscriptionPlan = model<SubscriptionPlanAttrs, SubscriptionPlanModel>(
  "SubscriptionPlan",
  subscriptionPlanSchema,
);

export { SubscriptionPlan };
export type { SubscriptionPlanDocument, SubscriptionPlanAttrs };
