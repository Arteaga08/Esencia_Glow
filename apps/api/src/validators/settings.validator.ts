import Joi from "joi";
import { shippingAddressSchema } from "./shipping.validator.js";

/** El default de Joi cae en inglés y entre comillas ("taxRateBps" must be...),
 * que es exactamente lo que no debe llegarle al panel: cada campo numérico
 * declara su sujeto y su regla en español. */
function numberMessages(subject: string, rule: string) {
  return {
    "number.base": `${subject} debe ser un número`,
    "number.integer": `${subject} debe ser un número entero`,
    "number.min": `${subject} ${rule}`,
    "number.max": `${subject} ${rule}`,
  };
}

const EMPTY_PATCH_MESSAGES = { "object.min": "Indica al menos un ajuste para guardar" };

/** `.min(1)` exige al menos un campo — un PATCH vacío no tiene sentido. */
const updateInventorySettingsSchema = Joi.object({
  lowStockThreshold: Joi.number()
    .integer()
    .min(0)
    .messages(numberMessages("El umbral de inventario bajo", "no puede ser negativo")),
  reservationTtlMinutes: Joi.number()
    .integer()
    .min(1)
    .messages(numberMessages("La vigencia de la reserva", "debe ser de al menos 1 minuto")),
  sweepBatchSize: Joi.number()
    .integer()
    .min(1)
    .messages(numberMessages("El tamaño del lote de limpieza", "debe ser de al menos 1")),
}).min(1).messages(EMPTY_PATCH_MESSAGES);

/** El rango de forma se valida aquí (Joi); el cruce con el TTL de reserva
 * (§ shippingQuoteTtlMinutes > reservationTtlMinutes) lo valida
 * settings.service.ts, que es quien conoce ambas secciones a la vez. */
const updateCommerceSettingsSchema = Joi.object({
  taxRateBps: Joi.number()
    .integer()
    .min(0)
    .max(10_000)
    .messages(numberMessages("El IVA", "debe estar entre 0 % y 100 %")),
  freeShippingThresholdCents: Joi.number()
    .integer()
    .min(0)
    .messages(numberMessages("El monto mínimo para envío gratis", "no puede ser negativo")),
  shippingQuoteTtlMinutes: Joi.number()
    .integer()
    .min(1)
    .messages(numberMessages("La vigencia de la cotización de envío", "debe ser de al menos 1 minuto")),
}).min(1).messages(EMPTY_PATCH_MESSAGES);

const updatePaymentSettingsSchema = Joi.object({
  oxxoVoucherDays: Joi.number()
    .integer()
    .min(1)
    .max(7)
    .messages(numberMessages("La vigencia de la ficha OXXO", "debe estar entre 1 y 7 días")),
  oxxoConfirmationGraceHours: Joi.number()
    .integer()
    .min(24)
    .max(240)
    .messages(numberMessages("La gracia de confirmación", "debe estar entre 24 y 240 horas")),
}).min(1).messages(EMPTY_PATCH_MESSAGES);

/** Solo `billingAnchorDay`: `enrollmentOpen`/`enrollmentOpenedAt`/
 * `enrollmentClosesAt` no se aceptan aquí — los escriben los endpoints
 * dedicados de abrir/cerrar inscripciones (acciones auditables, no ajustes
 * libres de Settings). */
const updateSubscriptionSettingsSchema = Joi.object({
  billingAnchorDay: Joi.number()
    .integer()
    .min(1)
    .max(28)
    .messages(numberMessages("El día de cobro", "debe estar entre 1 y 28")),
}).min(1).messages(EMPTY_PATCH_MESSAGES);

/** La dirección de origen se manda COMPLETA (`required`): reemplaza la
 * anterior entera, nunca se mezcla campo a campo. */
const updateShippingSettingsSchema = Joi.object({
  origin: shippingAddressSchema.required(),
});

export {
  updateInventorySettingsSchema,
  updateCommerceSettingsSchema,
  updatePaymentSettingsSchema,
  updateSubscriptionSettingsSchema,
  updateShippingSettingsSchema,
};
