import Joi from "joi";

/**
 * `slug`, `currency`, `billingInterval`, `seatsTaken` e `isActive` nunca
 * aparecen: se derivan/gobiernan en el service (slug de `name`,
 * `isActive` solo cambia vía el endpoint dedicado de baja). `priceCents`
 * solo se acepta al CREAR — un `Price` de Stripe es inmutable para siempre
 * (decisión 1 de 1.7.2a), así que el PATCH ni siquiera lo declara: cambiar
 * el precio es crear un plan nuevo y desactivar el viejo. `maxActiveSeats`
 * sí se acepta en el update, pero pasa por la guarda atómica de
 * `updatePlan` — Joi solo valida su forma.
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
  maxActiveSeats: Joi.number().integer().min(0),
  sortOrder: Joi.number().integer(),
}).min(1);

export { createSubscriptionPlanSchema, updateSubscriptionPlanSchema };
