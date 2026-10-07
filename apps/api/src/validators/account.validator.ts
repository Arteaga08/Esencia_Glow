import Joi from "joi";
import { CFDI_USES, FISCAL_REGIMES, RFC_PATTERN } from "@esencia-glow/shared";
import { customerShippingAddressSchema } from "./shipping.validator.js";

/**
 * Schemas de entrada de /api/v1/account (Milestone 3.5b). `email`, `role` y
 * `emailVerified` no aparecen en ninguno: `validate()` descarta lo no declarado
 * (`stripUnknown`), así que nunca se pueden cambiar por el body.
 */

// `sanitizeInput` ya escapó el body antes de llegar aquí (`<script>` queda como
// `&lt;script&gt;`), así que además de `<`/`>` se rechazan esas entidades: un
// nombre o dirección nunca lleva marcado, y mejor un error en línea que
// guardar texto escapado.
const NO_HTML_PATTERN = /^(?!.*(?:[<>]|&lt;|&gt;))/s;

const MESSAGES = {
  "any.required": "Este campo es obligatorio",
  "string.base": "Valor inválido",
  "string.empty": "Este campo no puede ir vacío",
  "string.min": "Es demasiado corto",
  "string.max": "Es demasiado largo",
  "string.pattern.base": "Contiene caracteres no permitidos",
  "any.only": "Valor fuera del catálogo",
  "date.base": "Fecha inválida",
  "date.format": "Fecha inválida",
  "date.max": "La fecha no puede ser futura",
  "date.min": "La fecha es demasiado antigua",
  "object.min": "No hay nada que actualizar",
};

const text = (max: number) => Joi.string().trim().max(max).pattern(NO_HTML_PATTERN);
const name = () => Joi.string().trim().min(2).max(60).pattern(NO_HTML_PATTERN);
const postalCode = () =>
  Joi.string()
    .trim()
    .pattern(/^\d{5}$/)
    .messages({ "string.pattern.base": "El código postal debe tener 5 dígitos" });

const updateProfileSchema = Joi.object({
  firstName: name(),
  lastName: name(),
  phone: Joi.string()
    .trim()
    .pattern(/^\d{10}$/)
    .allow(null)
    .messages({ "string.pattern.base": "El teléfono debe tener 10 dígitos" }),
  birthDate: Joi.date().iso().min("1900-01-01").max("now").allow(null),
  city: text(120).allow(null),
})
  .min(1)
  .messages(MESSAGES);

// Campos de la dirección del checkout con la regla "sin HTML" encima. El
// resto de las reglas (largos, estado de catálogo, teléfono, CP) son las de
// `customerShippingAddressSchema`: una sola definición de "dirección válida".
const FREE_TEXT_ADDRESS_FIELDS = ["firstName", "lastName", "street", "exteriorNumber", "interiorNumber", "neighborhood", "city", "references"];
const baseAddress = customerShippingAddressSchema.fork(FREE_TEXT_ADDRESS_FIELDS, (field) => (field as Joi.StringSchema).pattern(NO_HTML_PATTERN));
const ADDRESS_FIELDS = [...FREE_TEXT_ADDRESS_FIELDS, "phone", "state", "postalCode"];

const createAddressSchema = baseAddress
  .keys({ label: text(40).min(1).required(), isDefault: Joi.boolean().strict() })
  .messages(MESSAGES);

const updateAddressSchema = baseAddress
  .fork(ADDRESS_FIELDS, (field) => field.optional())
  .fork(["interiorNumber", "references"], (field) => field.allow(null))
  .and("firstName", "lastName")
  .keys({ label: text(40).min(1) })
  .min(1)
  .messages(MESSAGES);

const objectId = Joi.string().hex().length(24);

const addressParamSchema = Joi.object({ addressId: objectId.required() });

const billingInfoSchema = Joi.object({
  rfc: Joi.string().trim().uppercase().pattern(RFC_PATTERN).required().messages({
    "string.pattern.base": "El RFC debe tener 12 o 13 caracteres, por ejemplo LOMM910312AB1",
  }),
  legalName: text(200).min(1).required(),
  cfdiUse: Joi.string()
    .valid(...CFDI_USES.map((option) => option.value))
    .allow(null),
  fiscalRegime: Joi.string()
    .valid(...FISCAL_REGIMES.map((option) => option.value))
    .allow(null),
  postalCode: postalCode().required(),
}).messages(MESSAGES);

const addWishlistItemSchema = Joi.object({
  itemType: Joi.string().valid("product").required(),
  itemId: objectId.required(),
}).messages(MESSAGES);

const wishlistQuerySchema = Joi.object({ itemId: objectId }).messages(MESSAGES);

const wishlistParamSchema = Joi.object({
  itemType: Joi.string().valid("product").required(),
  itemId: objectId.required(),
});

export {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  addressParamSchema,
  billingInfoSchema,
  addWishlistItemSchema,
  wishlistParamSchema,
  wishlistQuerySchema,
};
