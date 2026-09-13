import Joi from "joi";

/**
 * `slug`, `currency`, `billingInterval`, `seatsTaken` e `isActive` nunca
 * aparecen: se derivan/gobiernan en el service (slug de `name`,
 * `isActive` solo cambia vía el endpoint dedicado de baja). `priceCents` y
 * `maxActiveSeats` sí se aceptan en el update, pero pasan por las guardas
 * atómicas de `updatePlan` — Joi solo valida su forma.
 */
const createSubscriptionPlanSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().min(1).max(2000).required(),
  shortDescription: Joi.string().trim().max(300).allow(""),
  priceCents: Joi.number().integer().min(0).required().messages({
    "number.integer": "El precio debe ser un entero en centavos",
  }),
  maxActiveSeats: Joi.number().integer().min(0).required(),
  sortOrder: Joi.number().integer(),
});

const updateSubscriptionPlanSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  description: Joi.string().trim().min(1).max(2000),
  shortDescription: Joi.string().trim().max(300).allow(""),
  priceCents: Joi.number().integer().min(0),
  maxActiveSeats: Joi.number().integer().min(0),
  sortOrder: Joi.number().integer(),
}).min(1);

export { createSubscriptionPlanSchema, updateSubscriptionPlanSchema };
