import { Schema } from "mongoose";
import { shippingAddressSchema, type ShippingAddressAttrs } from "./shipping-address.schema.js";

/**
 * Dirección de la libreta de la clienta: EXACTAMENTE los campos de la dirección
 * del checkout (`shippingAddressSchema`, que se fusiona aquí, no se copia) más
 * etiqueta y principal. Nunca un modelo paralelo: así lo guardado se puede
 * mandar tal cual a cotizar. A diferencia del snapshot de la orden, tiene
 * `_id` propio porque se direcciona por id (`/account/addresses/:addressId`).
 *
 * La invariante "a lo más una principal" NO vive aquí: la resuelve la capa de
 * servicio (account-address.service.ts) en una sola escritura atómica.
 */
interface SavedAddressAttrs extends ShippingAddressAttrs {
  label: string;
  isDefault: boolean;
}

const savedAddressSchema = new Schema<SavedAddressAttrs>({}, { _id: true });
savedAddressSchema.add(shippingAddressSchema);
savedAddressSchema.add({
  label: { type: String, required: true, trim: true, maxlength: 40 },
  isDefault: { type: Boolean, default: false },
});

export { savedAddressSchema };
export type { SavedAddressAttrs };
