import Joi from "joi";
import { MAX_ORDER_LINES, MEXICAN_STATES } from "@esencia-glow/shared";
import { joinRecipientName } from "../utils/recipient-name.js";

/**
 * Valida el body de `POST /shipping/quotes`. `destination` es el mismo
 * shape que `shippingAddressSchema` (apps/api/src/models); se copia aquí
 * como Joi porque las capas de validación y de persistencia son
 * intencionalmente independientes (Joi valida la forma del payload, el
 * schema de Mongoose valida el documento).
 */
const objectId = Joi.string().hex().length(24);

const shippingAddressSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(200).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^\d{10}$/)
    .required()
    .messages({ "string.pattern.base": "El teléfono debe tener 10 dígitos" }),
  street: Joi.string().trim().min(1).max(200).required(),
  exteriorNumber: Joi.string().trim().min(1).max(20).required(),
  interiorNumber: Joi.string().trim().max(20),
  neighborhood: Joi.string().trim().min(1).max(120).required(),
  city: Joi.string().trim().min(1).max(120).required(),
  state: Joi.string()
    .valid(...MEXICAN_STATES)
    .required(),
  postalCode: Joi.string()
    .trim()
    .pattern(/^\d{5}$/)
    .required()
    .messages({ "string.pattern.base": "El código postal debe tener 5 dígitos" }),
  references: Joi.string().trim().max(300),
});

/**
 * Dirección que captura la clienta (checkout y libreta): nombre y apellidos por
 * separado. `fullName` no se acepta: se deriva de ambos para que el resto del
 * sistema (correos, Stripe, panel) siga leyendo un solo nombre. Con la regla
 * `and`, en una edición parcial van los dos juntos o ninguno.
 */
const customerShippingAddressSchema = shippingAddressSchema
  .keys({
    fullName: Joi.any().strip(),
    firstName: Joi.string().trim().min(1).max(100).required(),
    lastName: Joi.string().trim().min(1).max(100).required(),
  })
  .custom((value: { firstName?: string; lastName?: string }) =>
    value.firstName !== undefined && value.lastName !== undefined
      ? { ...value, fullName: joinRecipientName(value.firstName, value.lastName) }
      : value,
  );

const cartLineSchema = Joi.object({
  itemType: Joi.string().valid("product", "bundle").required(),
  itemId: objectId.required(),
  quantity: Joi.number().integer().min(1).required(),
});

const createShippingQuoteSchema = Joi.object({
  destination: customerShippingAddressSchema.required(),
  lines: Joi.array().items(cartLineSchema).min(1).max(MAX_ORDER_LINES).required(),
});

export { createShippingQuoteSchema, shippingAddressSchema, customerShippingAddressSchema, cartLineSchema };
