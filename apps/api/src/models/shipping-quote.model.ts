import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { CATALOG_CURRENCY, ShippingCarrier } from "@esencia-glow/shared";
import { shippingAddressSchema, type ShippingAddressAttrs } from "./shipping-address.schema.js";
import { parcelSchema, type ParcelAttrs } from "./parcel.schema.js";

/**
 * Cotizaciones de envío persistidas para que el checkout nunca reciba un
 * monto del cliente: el cliente manda `{quoteId, rateId}` y el servidor lee
 * el monto de aquí (ver shipping-quote.service.ts).
 *
 * TTL sobre `purgeAt` — a diferencia de `StockReservation`, aquí `purgeAt`
 * SÍ se escribe al crear (`= expiresAt + 24h`): borrar una cotización es
 * inocuo (no hay stock que orfanar), y el margen deja rastro forense de
 * "¿por qué me cobraron X de envío?". `expiresAt` se verifica en CÓDIGO —
 * el TTL monitor de Mongo borra perezosamente cada ~60s, así que un
 * documento vencido puede seguir existiendo varios minutos.
 *
 * No es de un solo uso: `consumedByOrderId` es forense, nunca invalida un
 * replay de idempotencia que reintente crear la misma orden.
 */
interface ShippingRateAttrs {
  /** Opaco y propio — nunca el id del proveedor. */
  rateId: string;
  carrier: ShippingCarrier;
  service: string;
  amountCents: number;
  currency: string;
  estimatedDays: number;
  /** El id real del proveedor (stub hoy, Skydropx en 1.9). NUNCA cruza al
   * cliente — solo lo usa el adapter para reclamar la tarifa real. */
  providerRateId?: string;
}

interface ShippingQuoteAttrs {
  userId: Types.ObjectId;
  cartFingerprint: string;
  destination: ShippingAddressAttrs;
  parcel: ParcelAttrs;
  rates: ShippingRateAttrs[];
  cheapestAmountCents: number;
  provider: "stub" | "skydropx";
  expiresAt: Date;
  purgeAt: Date;
  consumedByOrderId?: Types.ObjectId;
}

type ShippingQuoteDocument = HydratedDocument<ShippingQuoteAttrs>;
type ShippingQuoteModel = Model<ShippingQuoteAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const shippingRateSchema = new Schema<ShippingRateAttrs>(
  {
    rateId: { type: String, required: true },
    carrier: { type: String, required: true, enum: Object.values(ShippingCarrier) },
    service: { type: String, required: true, trim: true },
    amountCents: { type: Number, required: true, min: 0, validate: integerValidator },
    currency: { type: String, required: true, default: CATALOG_CURRENCY },
    estimatedDays: { type: Number, required: true, min: 0, validate: integerValidator },
    providerRateId: { type: String, trim: true },
  },
  { _id: false },
);

const shippingQuoteSchema = new Schema<ShippingQuoteAttrs, ShippingQuoteModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cartFingerprint: { type: String, required: true },
    destination: { type: shippingAddressSchema, required: true },
    parcel: { type: parcelSchema, required: true },
    rates: {
      type: [shippingRateSchema],
      required: true,
      validate: { validator: (rates: ShippingRateAttrs[]) => rates.length > 0, message: "Una cotización necesita al menos una tarifa" },
    },
    cheapestAmountCents: { type: Number, required: true, min: 0, validate: integerValidator },
    provider: { type: String, required: true, enum: ["stub", "skydropx"] },
    expiresAt: { type: Date, required: true },
    purgeAt: { type: Date, required: true },
    consumedByOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

shippingQuoteSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
shippingQuoteSchema.index({ userId: 1, cartFingerprint: 1, createdAt: -1 });

const ShippingQuote = model<ShippingQuoteAttrs, ShippingQuoteModel>("ShippingQuote", shippingQuoteSchema);

export { ShippingQuote };
export type { ShippingQuoteAttrs, ShippingQuoteDocument, ShippingRateAttrs };
