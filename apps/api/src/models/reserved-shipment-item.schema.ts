import { Schema, type Types } from "mongoose";

/**
 * Snapshot de lo que `createCycleShipment` reservó en `Inventory.reserved`
 * al cobrarse el ciclo (Milestone 1.7.2a) — sin esto, 1.7.2b no puede
 * comprometer `reserved -> onHand` al marcar el envío como enviado: un
 * envío con `editionIncident` no tiene edición que releer, y una reserva
 * PARCIAL (inventario insuficiente) no coincide con los ítems de la
 * edición. `_id: false`, igual que `editionItemSchema`: es un snapshot
 * inmutable, no un sub-CRUD.
 */
interface ReservedShipmentItemAttrs {
  variantId: Types.ObjectId;
  quantity: number;
}

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const reservedShipmentItemSchema = new Schema<ReservedShipmentItemAttrs>(
  {
    variantId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  { _id: false },
);

export { reservedShipmentItemSchema };
export type { ReservedShipmentItemAttrs };
