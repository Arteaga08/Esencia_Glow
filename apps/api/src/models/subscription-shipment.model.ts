import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { ShippingCarrier, SubscriptionShipmentStatus } from "@esencia-glow/shared";
import { reservedShipmentItemSchema, type ReservedShipmentItemAttrs } from "./reserved-shipment-item.schema.js";

/**
 * Envío de un ciclo de suscripción — documento propio, NUNCA una `Order`
 * (decisión 4 del plan de 1.7.1): la caja mensual tiene su propia lista en
 * el panel, separada de los pedidos de la tienda.
 *
 * Se define en 1.7.1 aunque nadie lo escriba hasta 1.7.2, por una razón
 * concreta: sus dos índices únicos son la garantía de idempotencia del
 * webhook de renovación, el punto de mayor riesgo de todo el Milestone 1.7.
 * Construirlos y testearlos en frío ahora es más barato que descubrir en
 * 1.7.2 que una reentrega de `invoice.paid` armó dos cajas.
 *
 * `userId` va denormalizado pese a que `accountId` ya lo determina: la ruta
 * de la suscriptora (1.7.3) debe filtrar por propiedad DENTRO de la query
 * (`{_id, userId}` -> 404, nunca 403) — resolverlo vía `accountId` obligaría
 * a leer-y-comparar, el anti-patrón que la doctrina del proyecto prohíbe.
 *
 * `editionId` ausente = incidencia (decisión 8): si al cobrar la renovación
 * no hay `SubscriptionEdition` publicada para el ciclo, se cobra igual, el
 * envío se crea sin `editionId`, con `editionIncident: true` y
 * `adminAlertedAt` sellado por la alerta — calco de `inventoryIncident` +
 * `adminAlertedAt` en order.model.ts.
 *
 * Solo el enum de estado en 1.7.1; la máquina de transiciones la escribe
 * 1.7.2 junto con el panel que la consume.
 *
 * Guía y sellos (Milestone 1.7.2b): `carrier`/`trackingNumber` se capturan
 * al marcar `shipped` desde el panel, reusando el vocabulario cerrado
 * `ShippingCarrier` de la tienda — nunca texto libre, que rompería la
 * integración real de envíos. `stockCommittedAt` es el sello de idempotencia
 * del commit `reserved -> onHand`: ninguna ruta puede descontar dos veces la
 * misma caja. Los tres sellos de fecha (`shippedAt`/`deliveredAt`/
 * `canceledAt`) los escribe `subscription-shipment-admin.service.ts` en la
 * MISMA operación atómica que mueve el estado.
 *
 * `reservedItems`/`inventoryIncident` (Milestone 1.7.2a): al cobrarse el
 * ciclo se reserva (`Inventory.reserved`, nunca `onHand` todavía) lo que
 * alcance de cada ítem de la edición — "reserva al cobrar, salida al
 * enviar". Un faltante NUNCA rechaza el envío (el cobro ya ocurrió): se
 * reserva lo que sí hay y se sella `inventoryIncident`. Solo
 * `Inventory.reserved`, nunca `StockReservation`: esa colección se barre por
 * TTL, y una caja ya cobrada no debe soltarse en silencio por inactividad.
 */
interface SubscriptionShipmentAttrs {
  accountId: Types.ObjectId;
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  editionId?: Types.ObjectId;
  cycleYear: number;
  cycleMonth: number;
  status: SubscriptionShipmentStatus;
  editionIncident: boolean;
  adminAlertedAt?: Date;
  invoiceId?: string;
  reservedItems: ReservedShipmentItemAttrs[];
  inventoryIncident: boolean;
  carrier?: ShippingCarrier;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  canceledAt?: Date;
  stockCommittedAt?: Date;
}

type SubscriptionShipmentDocument = HydratedDocument<SubscriptionShipmentAttrs>;
type SubscriptionShipmentModel = Model<SubscriptionShipmentAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const subscriptionShipmentSchema = new Schema<SubscriptionShipmentAttrs, SubscriptionShipmentModel>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "SubscriptionAccount", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    editionId: { type: Schema.Types.ObjectId, ref: "SubscriptionEdition" },
    cycleYear: { type: Number, required: true, min: 2024, max: 2100, validate: integerValidator },
    cycleMonth: { type: Number, required: true, min: 1, max: 12, validate: integerValidator },
    status: {
      type: String,
      required: true,
      enum: Object.values(SubscriptionShipmentStatus),
      default: SubscriptionShipmentStatus.PENDING,
    },
    editionIncident: { type: Boolean, required: true, default: false },
    adminAlertedAt: { type: Date },
    invoiceId: { type: String, trim: true },
    reservedItems: { type: [reservedShipmentItemSchema], default: [] },
    inventoryIncident: { type: Boolean, required: true, default: false },
    carrier: { type: String, enum: Object.values(ShippingCarrier) },
    trackingNumber: { type: String, trim: true },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    canceledAt: { type: Date },
    stockCommittedAt: { type: Date },
  },
  { timestamps: true },
);

/** Una caja por suscriptora por ciclo, aunque facturación produjera dos
 * cobros: es la invariante de negocio. */
subscriptionShipmentSchema.index({ accountId: 1, cycleYear: 1, cycleMonth: 1 }, { unique: true });
/** Idempotencia del webhook: una reentrega de `invoice.paid` trae el mismo
 * `invoiceId` -> E11000 -> se ignora. Parcial, mismo motivo que
 * `payment.intentId` en order.model.ts. */
subscriptionShipmentSchema.index(
  { invoiceId: 1 },
  { unique: true, partialFilterExpression: { invoiceId: { $type: "string" } } },
);
subscriptionShipmentSchema.index({ status: 1, createdAt: -1 });
/** Filtro por plan y ciclo del panel de envíos (Milestone 1.7.2b). */
subscriptionShipmentSchema.index({ planId: 1, cycleYear: -1, cycleMonth: -1 });
/** `GET /subscriptions/me` (Milestone 1.7.2b): la suscriptora lista SUS cajas
 * ordenadas por ciclo descendente. Cubre filtro y orden en el mismo índice —
 * sin él ese endpoint (el más caliente del storefront para una suscriptora)
 * hace collection scan más un sort en memoria. */
subscriptionShipmentSchema.index({ userId: 1, cycleYear: -1, cycleMonth: -1 });

const SubscriptionShipment = model<SubscriptionShipmentAttrs, SubscriptionShipmentModel>(
  "SubscriptionShipment",
  subscriptionShipmentSchema,
);

export { SubscriptionShipment };
export type { SubscriptionShipmentDocument, SubscriptionShipmentAttrs };
