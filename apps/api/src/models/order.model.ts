import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import {
  CATALOG_CURRENCY,
  DisputeStatus,
  OrderPriority,
  OrderStatus,
  PaymentMethod,
  PaymentState,
  ShippingCarrier,
} from "@esencia-glow/shared";
import { orderLineSchema, type OrderLineAttrs } from "./order-line.schema.js";
import { shippingAddressSchema, type ShippingAddressAttrs } from "./shipping-address.schema.js";
import { parcelSchema, type ParcelAttrs } from "./parcel.schema.js";

/**
 * Documento de orden — el corazón transaccional del checkout. Snapshot
 * inmutable de todo lo necesario para renderizar y auditar la compra sin
 * volver a leer el catálogo (ver ECOMMERCE_ARCHITECTURE_GUIDELINES.md
 * §"Módulo de Órdenes"). `status` nunca se escribe directo: toda transición
 * pasa por `order-state.ts` (`assertTransition`).
 */

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };
const MAX_STATUS_HISTORY_LENGTH = 50;
const MAX_INTERNAL_NOTES_LENGTH = 50;

interface OrderPaymentCardAttrs {
  brand: string;
  last4: string;
}

interface OrderPaymentAttrs {
  provider: "stripe";
  /** Elegido por la clienta al hacer checkout (Milestone 1.6): decide el
   * flujo de reserva/cierre (ver payment-deadlines.ts, order-closing.service.ts). */
  method: PaymentMethod;
  state: PaymentState;
  captureMethod: "automatic";
  intentId?: string;
  capturedAt?: Date;
  lastError?: string;
  refundedAmountCents?: number;
  refundedAt?: Date;
  card?: OrderPaymentCardAttrs;
  /** Solo OXXO: cuándo vence la ficha, según lo que devuelve Stripe. */
  voucherExpiresAt?: Date;
  /** Última vez que el reconciliador consultó a Stripe por este pago —
   * evita re-consultar en el mismo tick (backoff simple). */
  lastCheckedAt?: Date;
  /** Sellado al pedir un reembolso (antes de que el webhook lo confirme). */
  refundRequestedAt?: Date;
  /** Rechazos de tarjeta consecutivos en este pedido — anti card-testing
   * (decisión 10 del plan de 1.6): al llegar a MAX_CARD_FAILED_ATTEMPTS se
   * cierra el pedido. Nunca se incrementa para OXXO. */
  failedAttempts: number;
}

interface OrderShippingSelectionAttrs {
  rateId: string;
  carrier: ShippingCarrier;
  service: string;
  amountCents: number;
  estimatedDays: number;
}

interface OrderShipmentAttrs {
  carrier: ShippingCarrier;
  carrierName?: string;
  trackingNumber: string;
  trackingUrl?: string;
  shippedAt: Date;
}

interface OrderStatusHistoryEntryAttrs {
  status: OrderStatus;
  at: Date;
  actorType: "user" | "system";
  actorId?: Types.ObjectId;
  reason?: string;
}

interface OrderInternalNoteAttrs {
  body: string;
  authorId: Types.ObjectId;
  at: Date;
}

interface OrderAttrs {
  orderNumber: string;
  userId: Types.ObjectId;
  status: OrderStatus;
  lines: OrderLineAttrs[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  taxRateBps: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  payment: OrderPaymentAttrs;
  shippingAddress: ShippingAddressAttrs;
  shippingSelection: OrderShippingSelectionAttrs;
  parcel: ParcelAttrs;
  shipment?: OrderShipmentAttrs;
  termsAcceptedAt: Date;
  idempotencyKey?: string;
  requestHash?: string;
  reservationId: Types.ObjectId;
  expiresAt?: Date;
  statusHistory: OrderStatusHistoryEntryAttrs[];
  priority: OrderPriority;
  internalNotes: OrderInternalNoteAttrs[];
  cancelReason?: string;
  inventoryIncident: boolean;
  adminAlertedAt?: Date;
  /** Contracargo (Milestone 1.6): vive en la orden, no en `payment` — es un
   * evento del ciclo de vida de la venta, no un atributo del cobro. Un
   * contracargo perdido NO es `refunded`. */
  disputedAt?: Date;
  disputeStatus?: DisputeStatus;
}

type OrderDocument = HydratedDocument<OrderAttrs>;
type OrderModel = Model<OrderAttrs>;

const orderPaymentSchema = new Schema<OrderPaymentAttrs>(
  {
    provider: { type: String, required: true, enum: ["stripe"] },
    method: { type: String, required: true, enum: Object.values(PaymentMethod), default: PaymentMethod.CARD },
    state: { type: String, required: true, enum: Object.values(PaymentState) },
    captureMethod: { type: String, required: true, enum: ["automatic"] },
    intentId: { type: String, trim: true },
    capturedAt: { type: Date },
    lastError: { type: String, trim: true, maxlength: 500 },
    refundedAmountCents: { type: Number, min: 0, validate: integerValidator },
    refundedAt: { type: Date },
    card: {
      type: new Schema<OrderPaymentCardAttrs>(
        { brand: { type: String, required: true }, last4: { type: String, required: true } },
        { _id: false },
      ),
    },
    voucherExpiresAt: { type: Date },
    lastCheckedAt: { type: Date },
    refundRequestedAt: { type: Date },
    failedAttempts: { type: Number, required: true, default: 0, min: 0, validate: integerValidator },
  },
  { _id: false },
);

const orderShippingSelectionSchema = new Schema<OrderShippingSelectionAttrs>(
  {
    rateId: { type: String, required: true },
    carrier: { type: String, required: true, enum: Object.values(ShippingCarrier) },
    service: { type: String, required: true, trim: true },
    amountCents: { type: Number, required: true, min: 0, validate: integerValidator },
    estimatedDays: { type: Number, required: true, min: 0, validate: integerValidator },
  },
  { _id: false },
);

const orderShipmentSchema = new Schema<OrderShipmentAttrs>(
  {
    carrier: { type: String, required: true, enum: Object.values(ShippingCarrier) },
    carrierName: { type: String, trim: true },
    trackingNumber: { type: String, required: true, trim: true },
    trackingUrl: { type: String, trim: true },
    shippedAt: { type: Date, required: true },
  },
  { _id: false },
);

const orderStatusHistoryEntrySchema = new Schema<OrderStatusHistoryEntryAttrs>(
  {
    status: { type: String, required: true, enum: Object.values(OrderStatus) },
    at: { type: Date, required: true },
    actorType: { type: String, required: true, enum: ["user", "system"] },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const orderInternalNoteSchema = new Schema<OrderInternalNoteAttrs>(
  {
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

/** Un array sin techo es un DoS del documento contra sí mismo. */
function boundedArrayValidator(max: number) {
  return {
    validator: (arr: unknown[]) => arr.length <= max,
    message: `{PATH} no puede tener más de ${max} entradas`,
  };
}

const orderSchema = new Schema<OrderAttrs, OrderModel>(
  {
    orderNumber: { type: String, required: true, trim: true, uppercase: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, required: true, enum: Object.values(OrderStatus), default: OrderStatus.PENDING },
    lines: {
      type: [orderLineSchema],
      required: true,
      validate: { validator: (lines: OrderLineAttrs[]) => lines.length > 0, message: "Una orden necesita al menos una línea" },
    },
    subtotalCents: { type: Number, required: true, min: 0, validate: integerValidator },
    discountCents: { type: Number, required: true, min: 0, default: 0, validate: integerValidator },
    taxCents: { type: Number, required: true, min: 0, validate: integerValidator },
    taxRateBps: { type: Number, required: true, min: 0, validate: integerValidator },
    shippingCents: { type: Number, required: true, min: 0, validate: integerValidator },
    totalCents: { type: Number, required: true, min: 0, validate: integerValidator },
    currency: { type: String, required: true, default: CATALOG_CURRENCY },
    payment: { type: orderPaymentSchema, required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    shippingSelection: { type: orderShippingSelectionSchema, required: true },
    parcel: { type: parcelSchema, required: true },
    shipment: { type: orderShipmentSchema },
    termsAcceptedAt: { type: Date, required: true },
    idempotencyKey: { type: String, trim: true },
    requestHash: { type: String, trim: true },
    reservationId: { type: Schema.Types.ObjectId, ref: "StockReservation", required: true },
    expiresAt: { type: Date },
    statusHistory: {
      type: [orderStatusHistoryEntrySchema],
      default: [],
      validate: boundedArrayValidator(MAX_STATUS_HISTORY_LENGTH),
    },
    priority: { type: String, enum: Object.values(OrderPriority), default: OrderPriority.NORMAL },
    internalNotes: {
      type: [orderInternalNoteSchema],
      default: [],
      validate: boundedArrayValidator(MAX_INTERNAL_NOTES_LENGTH),
    },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    inventoryIncident: { type: Boolean, default: false },
    adminAlertedAt: { type: Date },
    disputedAt: { type: Date },
    disputeStatus: { type: String, enum: Object.values(DisputeStatus) },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1, expiresAt: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

/**
 * `userId` va en la clave, no un índice global sobre `idempotencyKey`: un
 * índice global convertiría la rama de replay en una fuga de datos entre
 * usuarios (dos clientes podrían, en teoría, coincidir en la misma key).
 * Parcial y NO `sparse`: un `sparse` compuesto indexa el documento si
 * CUALQUIERA de sus campos existe, y `userId` siempre existe — indexaría
 * cada orden sin key como `{userId, null}` y la segunda orden sin key del
 * mismo cliente chocaría contra su propia primera.
 */
orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

/**
 * Un solo checkout vivo por cliente, garantizado en el motor de datos.
 * Cancelar órdenes viejas antes de crear la nueva sería read-then-act y
 * fallaría bajo concurrencia; este índice convierte al perdedor de la
 * carrera en un 409 explícito.
 */
orderSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: OrderStatus.PENDING } },
);

/** Único: un pago no puede ser reclamado por dos órdenes — la única
 * búsqueda que hará el webhook de 1.6. */
orderSchema.index(
  { "payment.intentId": 1 },
  { unique: true, partialFilterExpression: { "payment.intentId": { $type: "string" } } },
);

const Order = model<OrderAttrs, OrderModel>("Order", orderSchema);

export { Order };
export type {
  OrderAttrs,
  OrderDocument,
  OrderPaymentAttrs,
  OrderShippingSelectionAttrs,
  OrderShipmentAttrs,
  OrderStatusHistoryEntryAttrs,
  OrderInternalNoteAttrs,
};
