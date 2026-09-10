import { Schema } from "mongoose";
import { MEXICAN_STATES } from "@esencia-glow/shared";

/**
 * Snapshot de dirección de envío + contacto. Compartido por `Order`
 * (congelada al comprar) y `ShippingQuote` (destino cotizado) — el checkout
 * SIEMPRE copia la dirección de la cotización al crear la orden, nunca una
 * que el cliente vuelva a mandar en el payload de `/orders`, para que un
 * desajuste cotización↔envío sea imposible por construcción (ver
 * shipping-quote.service.ts).
 *
 * `state` es una lista cerrada (`MEXICAN_STATES`): texto libre rompería la
 * llamada real a Skydropx en 1.9.
 */
interface ShippingAddressAttrs {
  fullName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  references?: string;
}

const shippingAddressSchema = new Schema<ShippingAddressAttrs>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, match: /^\d{10}$/ },
    street: { type: String, required: true, trim: true, maxlength: 200 },
    exteriorNumber: { type: String, required: true, trim: true, maxlength: 20 },
    interiorNumber: { type: String, trim: true, maxlength: 20 },
    neighborhood: { type: String, required: true, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, required: true, enum: MEXICAN_STATES },
    postalCode: { type: String, required: true, trim: true, match: /^\d{5}$/ },
    references: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

export { shippingAddressSchema };
export type { ShippingAddressAttrs };
