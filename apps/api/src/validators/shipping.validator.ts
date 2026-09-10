import Joi from "joi";
import { MAX_ORDER_LINES, MEXICAN_STATES } from "@esencia-glow/shared";

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

const cartLineSchema = Joi.object({
  itemType: Joi.string().valid("product", "bundle").required(),
  itemId: objectId.required(),
  quantity: Joi.number().integer().min(1).required(),
});

const createShippingQuoteSchema = Joi.object({
  destination: shippingAddressSchema.required(),
  lines: Joi.array().items(cartLineSchema).min(1).max(MAX_ORDER_LINES).required(),
});

export { createShippingQuoteSchema, shippingAddressSchema, cartLineSchema };
