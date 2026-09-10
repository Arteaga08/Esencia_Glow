import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { ReservationStatus } from "@esencia-glow/shared";

/**
 * Una reserva = un carrito, con una o más líneas de variante ya deduplicadas
 * (ver stock-reservation.service.ts — nunca dos líneas para el mismo
 * `variantId`, sino una sola con la cantidad sumada). `lines` es el registro
 * de qué se apartó; `sum(lines.quantity) de reservas active` debe cuadrar
 * siempre con `Inventory.reserved` de esa variante.
 *
 * `sourceBundles` es puramente descriptivo (trazabilidad para 1.4.1) y NUNCA
 * se usa para calcular ningún `$inc` — las líneas ya vienen fusionadas por
 * variante antes de llegar aquí, así que una procedencia por línea se
 * perdería en la fusión.
 *
 * TTL sobre `purgeAt`, NO sobre `expiresAt`, y `purgeAt` se deja sin definir
 * al crear la reserva: solo se escribe en el mismo update que la lleva a un
 * estado terminal (commit/release). El TTL de Mongo borra documentos, no
 * ejecuta lógica compensatoria — si el TTL corriera sobre `expiresAt`, una
 * reserva `active` vencida podría desaparecer sin que su `reserved` se
 * devolviera jamás. Con el campo ausente hasta el estado terminal, es
 * IMPOSIBLE por construcción que el TTL borre una reserva `active`: el cron
 * (release-expired-reservations.ts) es el único que compensa el stock.
 */
interface ReservationLineAttrs {
  variantId: Types.ObjectId;
  sku: string;
  quantity: number;
}

interface SourceBundleAttrs {
  bundleId: Types.ObjectId;
  quantity: number;
}

interface StockReservationAttrs {
  cartRef: string;
  userId?: Types.ObjectId;
  lines: ReservationLineAttrs[];
  sourceBundles?: SourceBundleAttrs[];
  status: ReservationStatus;
  expiresAt: Date;
  purgeAt?: Date;
}

type StockReservationDocument = HydratedDocument<StockReservationAttrs>;
type StockReservationModel = Model<StockReservationAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const reservationLineSchema = new Schema<ReservationLineAttrs>(
  {
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  { _id: false },
);

const sourceBundleSchema = new Schema<SourceBundleAttrs>(
  {
    bundleId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  { _id: false },
);

const stockReservationSchema = new Schema<StockReservationAttrs, StockReservationModel>(
  {
    cartRef: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    lines: {
      type: [reservationLineSchema],
      required: true,
      validate: {
        validator: (lines: ReservationLineAttrs[]) => lines.length > 0,
        message: "Una reserva necesita al menos una línea",
      },
    },
    sourceBundles: { type: [sourceBundleSchema], default: undefined },
    status: {
      type: String,
      enum: Object.values(ReservationStatus),
      default: ReservationStatus.ACTIVE,
    },
    expiresAt: { type: Date, required: true },
    purgeAt: { type: Date },
  },
  { timestamps: true },
);

stockReservationSchema.index({ status: 1, expiresAt: 1 });
stockReservationSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
stockReservationSchema.index(
  { cartRef: 1 },
  { unique: true, partialFilterExpression: { status: ReservationStatus.ACTIVE } },
);
stockReservationSchema.index(
  { userId: 1, createdAt: -1 },
  { partialFilterExpression: { userId: { $exists: true } } },
);

const StockReservation = model<StockReservationAttrs, StockReservationModel>(
  "StockReservation",
  stockReservationSchema,
);

export { StockReservation };
export type { StockReservationAttrs, StockReservationDocument, ReservationLineAttrs };
