import Joi from "joi";

/** `.min(1)` exige al menos un campo — un PATCH vacío no tiene sentido. */
const updateInventorySettingsSchema = Joi.object({
  lowStockThreshold: Joi.number().integer().min(0),
  reservationTtlMinutes: Joi.number().integer().min(1),
  sweepBatchSize: Joi.number().integer().min(1),
}).min(1);

export { updateInventorySettingsSchema };
