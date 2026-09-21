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

/**
 * `POST /subscriptions/me/cancel` (Milestone 1.7.3). El motivo es opcional y
 * texto libre de la clienta: `.empty("")` trata la cadena vacía como ausente.
 * `.default({})` porque un POST SIN body deja `req.body` en `undefined`, no en
 * `{}` (mismo caso que `openEnrollmentSchema`).
 */
const cancelSubscriptionSchema = Joi.object({
  reason: Joi.string().trim().max(300).empty(""),
}).default({});

/** `POST /subscriptions/me/change-plan`. Solo el id: el precio y la moneda los
 * lee el servidor del plan, nunca del cliente. */
const changePlanSchema = Joi.object({
  planId: Joi.string().hex().length(24).required(),
});

/** `PUT /subscriptions/me/payment-method`. Un id de SetupIntent de Stripe
 * (`seti_...`): rechazar otros prefijos corta un id ajeno o mal formado antes
 * de gastar una llamada al proveedor. */
const confirmPaymentMethodSchema = Joi.object({
  setupIntentId: Joi.string()
    .trim()
    .max(255)
    .pattern(/^seti_[A-Za-z0-9_]+$/)
    .required(),
});

export { startSubscriptionSchema, cancelSubscriptionSchema, changePlanSchema, confirmPaymentMethodSchema };
