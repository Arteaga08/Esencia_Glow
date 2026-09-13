import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { EditionStatus, MAX_EDITION_ITEMS } from "@esencia-glow/shared";
import { editionItemSchema, type EditionItemAttrs } from "./edition-item.schema.js";

/**
 * Edición curada de un plan para un ciclo puntual (Milestone 1.7.1). El
 * ciclo se identifica con `cycleYear` + `cycleMonth` como enteros separados,
 * no un string `"2026-09"` ni un `Date` — un `Date` arrastraría ambigüedad
 * de zona horaria a la clave del negocio (ver utils/resolve-cycle.ts, que
 * en 1.7.2 traduce el `period_start` UTC de Stripe a este mismo par).
 *
 * `items` arranca vacío (a diferencia de `Bundle`, que exige ≥1 al crear):
 * el admin crea el cascarón del mes y lo va llenando; el ≥1 se exige AL
 * PUBLICAR (ver subscription-edition-publish.service.ts). Ya publicada,
 * `items`/`planId`/`cycleYear`/`cycleMonth` son inmutables — solo
 * `title`/`description` siguen editables.
 *
 * `firstBilledAt` queda reservado para 1.7.2: sella la edición en cuanto se
 * cobró contra ella, y es el guard de `unpublishEdition` (no se puede
 * despublicar una edición que ya generó un cobro).
 */
interface SubscriptionEditionAttrs {
  planId: Types.ObjectId;
  cycleYear: number;
  cycleMonth: number;
  title: string;
  description?: string;
  items: EditionItemAttrs[];
  status: EditionStatus;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  firstBilledAt?: Date;
}

type SubscriptionEditionDocument = HydratedDocument<SubscriptionEditionAttrs>;
type SubscriptionEditionModel = Model<SubscriptionEditionAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

/** Un array de ítems de edición sin techo es un DoS del documento contra sí
 * mismo — mismo criterio que `boundedArrayValidator` de order.model.ts. */
function maxItemsValidator(max: number) {
  return {
    validator: (items: unknown[]) => items.length <= max,
    message: `{PATH} no puede tener más de ${max} entradas`,
  };
}

const subscriptionEditionSchema = new Schema<SubscriptionEditionAttrs, SubscriptionEditionModel>(
  {
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    cycleYear: { type: Number, required: true, min: 2024, max: 2100, validate: integerValidator },
    cycleMonth: { type: Number, required: true, min: 1, max: 12, validate: integerValidator },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 3000 },
    items: {
      type: [editionItemSchema],
      default: [],
      validate: maxItemsValidator(MAX_EDITION_ITEMS),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(EditionStatus),
      default: EditionStatus.DRAFT,
    },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    firstBilledAt: { type: Date },
  },
  { timestamps: true },
);

/**
 * Dos ediciones del mismo plan para el mismo ciclo son imposibles, publicadas
 * o no: SIN filtro parcial a propósito. Dos admins creando "Esencial ·
 * octubre" a la vez chocan en el motor (E11000 -> 409), no en un `findOne`
 * previo — mismo patrón que el índice `{userId, idempotencyKey}` de Order.
 */
subscriptionEditionSchema.index({ planId: 1, cycleYear: 1, cycleMonth: 1 }, { unique: true });
subscriptionEditionSchema.index({ status: 1, cycleYear: -1, cycleMonth: -1 });
/** Integridad referencial: "¿alguna edición usa esta variante?" — precedente
 * literal de bundleSchema.index({"items.variantId": 1}) en bundle.model.ts.
 * Consumido por product-variant.service.ts (paso 9 del plan de 1.7.1). */
subscriptionEditionSchema.index({ "items.variantId": 1 });

const SubscriptionEdition = model<SubscriptionEditionAttrs, SubscriptionEditionModel>(
  "SubscriptionEdition",
  subscriptionEditionSchema,
);

export { SubscriptionEdition };
export type { SubscriptionEditionDocument, SubscriptionEditionAttrs };
