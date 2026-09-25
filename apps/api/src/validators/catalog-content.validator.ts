import Joi from "joi";

/**
 * Piezas de validación compartidas entre `product.validator.ts` y
 * `bundle.validator.ts` (Milestone 2.2.3: Bundle ganó `content`/`listPrice`/
 * `badgeId`, los mismos tres campos que Product tiene desde 2.2.1). Vivían
 * duplicadas en cada validador — un solo lugar evita que un ajuste de tope o
 * de mensaje quede aplicado a uno y olvidado en el otro.
 */

/**
 * Contenido editorial: cada bloque es una lista de `{ title, text }` que el
 * storefront pinta con el título en negrita — nunca texto libre, ver
 * product-content.schema.ts. Tope de 20 líneas por bloque: suficiente para
 * cualquier rutina real, evita un payload sin límite.
 */
const contentItemSchema = Joi.object({
  title: Joi.string().trim().min(1).max(80).required().messages({
    "string.empty": "El título es obligatorio",
    "string.min": "El título es obligatorio",
    "string.max": "El título no puede tener más de 80 caracteres",
    "any.required": "El título es obligatorio",
  }),
  text: Joi.string().trim().min(1).max(400).required().messages({
    "string.empty": "El texto es obligatorio",
    "string.min": "El texto es obligatorio",
    "string.max": "El texto no puede tener más de 400 caracteres",
    "any.required": "El texto es obligatorio",
  }),
});

const contentListSchema = Joi.array().items(contentItemSchema).max(20).messages({
  "array.max": "No puedes agregar más de 20 elementos en esta lista",
});

const contentSchema = Joi.object({
  ingredients: contentListSchema,
  routineSteps: contentListSchema,
  usage: contentListSchema,
  benefits: contentListSchema,
});

const badgeIdSchema = Joi.string().hex().length(24).allow(null).messages({
  "string.hex": "La badge no es válida",
  "string.length": "La badge no es válida",
});

/** Precio de lista, centavos — SOLO presentación (el "antes" tachado). */
const listPriceSchema = Joi.number().integer().min(0).allow(null).messages({
  "number.base": "El precio anterior debe ser un número",
  "number.integer": "El precio anterior debe ser un entero en centavos",
  "number.min": "El precio anterior no puede ser negativo",
});

/**
 * `listPrice`, si viene, debe ser mayor que `price` en el MISMO payload — un
 * PATCH que cambia solo uno de los dos y deja el otro desactualizado lo cubre
 * quien llama esto (ver `assertListPriceAboveSalePrice` en
 * product-variant.service.ts y su equivalente en bundle.service.ts), porque
 * ahí sí se conoce el valor vigente del campo que no llegó.
 */
function validateListPriceAboveSalePrice(
  value: { price?: number; listPrice?: number | null },
  helpers: Joi.CustomHelpers,
) {
  const { price, listPrice } = value;
  if (listPrice != null && price != null && listPrice <= price) {
    return helpers.error("object.listPriceNotGreater");
  }
  return value;
}

const listPriceMessages = {
  "object.listPriceNotGreater": "El precio anterior debe ser mayor al precio actual",
};

export {
  contentItemSchema,
  contentListSchema,
  contentSchema,
  badgeIdSchema,
  listPriceSchema,
  validateListPriceAboveSalePrice,
  listPriceMessages,
};
