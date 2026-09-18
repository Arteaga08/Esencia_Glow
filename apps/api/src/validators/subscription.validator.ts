import Joi from "joi";

/**
 * Valida el body de `POST /subscriptions` (Fase 4 de 1.7.2a, §E del plan).
 * Deliberadamente NO acepta montos, `priceId` ni fechas — con
 * `stripUnknown: true` en el middleware `validate`, el servidor deriva todo
 * del plan en la base (mismo criterio que `createOrderSchema`).
 */
const startSubscriptionSchema = Joi.object({
  planId: Joi.string().hex().length(24).required(),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    "any.only": "Debes aceptar los términos y condiciones.",
    "any.required": "Debes aceptar los términos y condiciones.",
  }),
});

export { startSubscriptionSchema };
