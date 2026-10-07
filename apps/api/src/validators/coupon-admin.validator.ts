import Joi from "joi";
import {
  COUPON_CODE_MAX_LENGTH,
  COUPON_CODE_MIN_LENGTH,
  COUPON_CODE_PATTERN,
  COUPON_DESCRIPTION_MAX_LENGTH,
  COUPON_MAX_PER_CUSTOMER_LIMIT,
  CouponDiscountType,
  CouponKind,
} from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

/**
 * Validadores del panel de cupones (Milestone 3.7). Los mensajes van en
 * español y en lenguaje humano porque el panel los pinta pegados al campo.
 * Deliberadamente NO aceptan `kind`, `customersCount`, `isActive` ni
 * `createdBy` al crear: con `stripUnknown` en `validate`, el cliente no puede
 * colar la clase del cupón ni sus contadores.
 */

const codeSchema = Joi.string()
  .trim()
  .uppercase()
  .min(COUPON_CODE_MIN_LENGTH)
  .max(COUPON_CODE_MAX_LENGTH)
  .pattern(COUPON_CODE_PATTERN)
  .required()
  .messages({
    "string.base": "Escribe un código.",
    "string.empty": "Escribe un código.",
    "any.required": "Escribe un código.",
    "string.min": `El código necesita al menos ${COUPON_CODE_MIN_LENGTH} caracteres.`,
    "string.max": `El código admite hasta ${COUPON_CODE_MAX_LENGTH} caracteres.`,
    "string.pattern.base": "Usa solo letras sin acento, números y guiones, sin espacios.",
  });

const percentOffSchema = Joi.number()
  .integer()
  .min(1)
  .max(100)
  .when("discountType", { is: CouponDiscountType.PERCENT, then: Joi.required(), otherwise: Joi.forbidden() })
  .messages({
    "number.base": "Escribe un porcentaje entre 1 y 100.",
    "number.integer": "Escribe un porcentaje entero, sin decimales.",
    "number.min": "El porcentaje va de 1 a 100.",
    "number.max": "El porcentaje va de 1 a 100.",
    "any.required": "Escribe el porcentaje de descuento.",
    "any.unknown": "Un cupón de porcentaje no lleva monto fijo; quítalo.",
  });

const amountOffSchema = Joi.number()
  .integer()
  .min(100)
  .when("discountType", { is: CouponDiscountType.FIXED, then: Joi.required(), otherwise: Joi.forbidden() })
  .messages({
    "number.base": "Escribe el monto del descuento.",
    "number.integer": "El monto debe ir en pesos y centavos exactos.",
    "number.min": "El descuento mínimo es de $1.00.",
    "any.required": "Escribe el monto del descuento.",
    "any.unknown": "Un cupón de monto fijo no lleva porcentaje; quítalo.",
  });

const startsAtSchema = Joi.date().iso().messages({ "date.base": "Elige una fecha de inicio válida.", "date.format": "Elige una fecha de inicio válida." });

const endsAtSchema = Joi.date()
  .iso()
  .min("now")
  .when("startsAt", { is: Joi.exist(), then: Joi.date().greater(Joi.ref("startsAt")) })
  .messages({
    "date.base": "Elige una fecha de fin válida.",
    "date.format": "Elige una fecha de fin válida.",
    "date.min": "La fecha de fin ya pasó. Elige una fecha futura.",
    "date.greater": "La fecha de fin debe ser posterior a la de inicio.",
  });

const sharedCouponKeys = {
  code: codeSchema,
  description: Joi.string()
    .trim()
    .allow("")
    .max(COUPON_DESCRIPTION_MAX_LENGTH)
    .default("")
    .messages({ "string.max": `La descripción admite hasta ${COUPON_DESCRIPTION_MAX_LENGTH} caracteres.` }),
  discountType: Joi.string()
    .valid(...Object.values(CouponDiscountType))
    .required()
    .messages({ "any.required": "Elige el tipo de descuento.", "any.only": "Elige porcentaje o monto fijo." }),
  percentOff: percentOffSchema,
  amountOffCents: amountOffSchema,
  minSubtotalCents: Joi.number().integer().min(0).messages({
    "number.base": "Escribe el monto mínimo de compra.",
    "number.integer": "El monto debe ir en pesos y centavos exactos.",
    "number.min": "El mínimo de compra no puede ser negativo.",
  }),
  startsAt: startsAtSchema,
  endsAt: endsAtSchema,
  perCustomerLimit: Joi.number()
    .integer()
    .min(1)
    .max(COUPON_MAX_PER_CUSTOMER_LIMIT)
    .default(1)
    .messages({
      "number.base": "Escribe cuántas veces puede usarlo cada clienta.",
      "number.integer": "Escribe un número entero de usos.",
      "number.min": "Cada clienta debe poder usarlo al menos 1 vez.",
      "number.max": `Cada clienta puede usarlo hasta ${COUPON_MAX_PER_CUSTOMER_LIMIT} veces.`,
    }),
};

/** `POST /admin/coupons`: cupón público, con tope opcional de personas. */
const createCouponSchema = Joi.object({
  ...sharedCouponKeys,
  maxCustomers: Joi.number().integer().min(1).messages({
    "number.base": "Escribe cuántas personas pueden usarlo.",
    "number.integer": "Escribe un número entero de personas.",
    "number.min": "El tope debe ser de al menos 1 persona.",
  }),
});

/** `POST /admin/customers/:id/coupons`: cupón personal, siempre para una sola clienta (sin tope de personas). */
const giveCouponSchema = Joi.object(sharedCouponKeys);

/** `PATCH /admin/coupons/:id`: un cupón creado solo se activa o desactiva, no cambia de valor. */
const setCouponActiveSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

const listCouponsQuerySchema = listQueryBaseSchema.keys({
  kind: Joi.string().valid(...Object.values(CouponKind)),
  status: Joi.string().valid("active", "inactive"),
});

export { createCouponSchema, giveCouponSchema, setCouponActiveSchema, listCouponsQuerySchema };
