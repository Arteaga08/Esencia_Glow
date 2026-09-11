import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { PAYMENT_EVENT_RETENTION_DAYS } from "@esencia-glow/shared";

/**
 * `PaymentEvent` — un renglón por evento de webhook entregado, y ES el
 * mecanismo de dedupe (no un log): el `insert` ocurre ANTES de despachar el
 * evento (ver payment-event.service.ts). `eventId` único ⇒ dos reentregas
 * simultáneas del mismo evento nunca pueden leer ambas "no visto" — la
 * carrera se resuelve donde debe: en la base, no en el código (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Colección PaymentEvent").
 *
 * `lockedAt` + `attempts` son el lease: una fila `processing` cuyo lease
 * venció es reclamable por la siguiente reentrega (caída a medias del
 * proceso). `completePaymentEvent`/`failPaymentEvent` filtran por el
 * `lockedAt` exacto que devolvió el claim — fencing, para que una entrega
 * vieja cuyo lease ya expiró y fue reclamado por otra no pueda pisar el
 * resultado.
 *
 * TTL sobre `purgeAt`, escrito AL INSERTAR (a diferencia de las reservas de
 * stock: purgar una fila vieja de `PaymentEvent` no deja nada colgado). La
 * ventana de retención ES la ventana de dedupe — purgado el renglón, una
 * reentrega de ese evento se procesaría de nuevo, y Stripe reintenta horas,
 * no meses.
 */
type PaymentEventStatus = "processing" | "processed" | "ignored" | "failed";

interface PaymentEventAttrs {
  provider: "stripe";
  eventId: string;
  type: string;
  status: PaymentEventStatus;
  lockedAt: Date;
  attempts: number;
  orderId?: string;
  error?: string;
  purgeAt: Date;
}

type PaymentEventDocument = HydratedDocument<PaymentEventAttrs>;
type PaymentEventModel = Model<PaymentEventAttrs>;

const PAYMENT_EVENT_STATUSES: PaymentEventStatus[] = ["processing", "processed", "ignored", "failed"];

const paymentEventSchema = new Schema<PaymentEventAttrs, PaymentEventModel>(
  {
    provider: { type: String, required: true, enum: ["stripe"] },
    eventId: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    status: { type: String, required: true, enum: PAYMENT_EVENT_STATUSES },
    lockedAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 1, min: 1 },
    orderId: { type: String, trim: true },
    error: { type: String, trim: true, maxlength: 500 },
    purgeAt: { type: Date, required: true },
  },
  { timestamps: true },
);

paymentEventSchema.index({ eventId: 1 }, { unique: true });
paymentEventSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

const PaymentEvent = model<PaymentEventAttrs, PaymentEventModel>("PaymentEvent", paymentEventSchema);

/** `purgeAt` para una fila nueva — helper para no repetir la aritmética de
 * fecha en cada caller de `payment-event.service.ts`. */
function computePaymentEventPurgeAt(now: Date): Date {
  return new Date(now.getTime() + PAYMENT_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export { PaymentEvent, computePaymentEventPurgeAt };
export type { PaymentEventAttrs, PaymentEventDocument, PaymentEventStatus };
