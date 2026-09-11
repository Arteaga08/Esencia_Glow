import Joi from "joi";

/** `.min(1)` exige al menos un campo — un PATCH vacío no tiene sentido. */
const updateInventorySettingsSchema = Joi.object({
  lowStockThreshold: Joi.number().integer().min(0),
  reservationTtlMinutes: Joi.number().integer().min(1),
  sweepBatchSize: Joi.number().integer().min(1),
}).min(1);

/** El rango de forma se valida aquí (Joi); el cruce con el TTL de reserva
 * (§ shippingQuoteTtlMinutes > reservationTtlMinutes) lo valida
 * settings.service.ts, que es quien conoce ambas secciones a la vez. */
const updateCommerceSettingsSchema = Joi.object({
  taxRateBps: Joi.number().integer().min(0).max(10_000),
  freeShippingThresholdCents: Joi.number().integer().min(0),
  shippingQuoteTtlMinutes: Joi.number().integer().min(1),
}).min(1);

export { updateInventorySettingsSchema, updateCommerceSettingsSchema };
