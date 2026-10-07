import Joi from "joi";
import { COUPON_CODE_MAX_LENGTH, MAX_ORDER_LINES, PaymentMethod } from "@esencia-glow/shared";
import { cartLineSchema } from "./shipping.validator.js";
import { listQueryBaseSchema } from "./list-query.validator.js";

/**
 * Valida el body de `POST /orders`. Deliberadamente NO acepta ningún monto
 * (`total`, `unitPriceCents`, `shippingCents`…) — con `stripUnknown: true`
 * en el middleware `validate`, cualquier intento del cliente de mandar un
 * precio se descarta antes de llegar al service; el servidor recalcula todo
 * desde la DB (ver order.service.ts::createOrder).
 */
const createOrderSchema = Joi.object({
  lines: Joi.array().items(cartLineSchema).min(1).max(MAX_ORDER_LINES).required(),
  quoteId: Joi.string().hex().length(24).required(),
  rateId: Joi.string().trim().min(1).required(),
  paymentMethod: Joi.string()
    .valid(...Object.values(PaymentMethod))
    .required(),
  // Solo el CÓDIGO, nunca un monto ni un porcentaje: el descuento lo calcula
  // el servidor desde el cupón guardado. Sin patrón estricto a propósito: un
  // código mal escrito debe llegar al servicio y responder COUPON_INVALID, el
  // mismo contrato de error que uno inexistente, no un 400 distinto.
  couponCode: Joi.string().trim().uppercase().max(COUPON_CODE_MAX_LENGTH).empty("").optional(),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    "any.only": "Debes aceptar los términos y condiciones.",
    "any.required": "Debes aceptar los términos y condiciones.",
  }),
});

const listMyOrdersQuerySchema = listQueryBaseSchema;

export { createOrderSchema, listMyOrdersQuerySchema };
