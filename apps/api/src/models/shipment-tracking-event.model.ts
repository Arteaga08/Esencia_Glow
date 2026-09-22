import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { ShipmentTrackingStatus } from "@esencia-glow/shared";

/**
 * Bitácora de eventos de rastreo de una orden (Milestone 1.9): UNA fila por
 * evento que reporta el proveedor de paquetería, en el orden en que llegan —
 * el estado agregado vive en `Order.tracking` (que solo avanza), pero aquí se
 * conserva TODO, incluso lo que llegó fuera de orden.
 *
 * El índice único `{provider, providerEventId}` es el dedupe de las
 * entregas repetidas del proveedor. Sin PII: ni la dirección ni el nombre de
 * la clienta — solo el evento del paquete.
 */
interface ShipmentTrackingEventAttrs {
  orderId: Types.ObjectId;
  provider: "stub" | "skydropx";
  providerEventId: string;
  status: ShipmentTrackingStatus;
  occurredAt: Date;
  description?: string;
  location?: string;
}

type ShipmentTrackingEventDocument = HydratedDocument<ShipmentTrackingEventAttrs>;
type ShipmentTrackingEventModel = Model<ShipmentTrackingEventAttrs>;

const shipmentTrackingEventSchema = new Schema<ShipmentTrackingEventAttrs, ShipmentTrackingEventModel>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    provider: { type: String, required: true, enum: ["stub", "skydropx"] },
    providerEventId: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, required: true, enum: Object.values(ShipmentTrackingStatus) },
    occurredAt: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    location: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

shipmentTrackingEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
shipmentTrackingEventSchema.index({ orderId: 1, occurredAt: 1 });

const ShipmentTrackingEvent = model<ShipmentTrackingEventAttrs, ShipmentTrackingEventModel>(
  "ShipmentTrackingEvent",
  shipmentTrackingEventSchema,
);

export { ShipmentTrackingEvent };
export type { ShipmentTrackingEventAttrs, ShipmentTrackingEventDocument };
