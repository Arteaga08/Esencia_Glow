import Joi from "joi";
import { ProductChannel } from "@esencia-glow/shared";
import { SKU_PATTERN } from "../models/product-variant.schema.js";
import {
  badgeIdSchema,
  contentSchema,
  listPriceMessages,
  listPriceSchema,
  validateListPriceAboveSalePrice,
} from "./catalog-content.validator.js";

/**
 * `slug` y `minPrice` nunca aparecen: se derivan en el service. Las variantes
 * se crean/editan por subrutas propias (createVariantSchema/updateVariantSchema),
 * nunca reemplazando el array completo — reemplazar regenera los `_id` de
 * Mongoose y rompería silenciosamente las referencias de inventario (1.4).
 *
 * Todo mensaje personalizado está en español: el default de Joi cae en
 * inglés y entre comillas ("weightGrams" must be...), que es exactamente lo
 * que no debe llegarle al panel (ver feedback-errores-en-linea-panel-admin).
 */

const dimensionsSchema = Joi.object({
  length: Joi.number().min(0.1).required().messages({
    "number.base": "El largo debe ser un número",
    "number.min": "El largo debe ser de al menos 0.1 cm",
    "any.required": "El largo es obligatorio",
  }),
  width: Joi.number().min(0.1).required().messages({
    "number.base": "El ancho debe ser un número",
    "number.min": "El ancho debe ser de al menos 0.1 cm",
    "any.required": "El ancho es obligatorio",
  }),
  height: Joi.number().min(0.1).required().messages({
    "number.base": "La altura debe ser un número",
    "number.min": "La altura debe ser de al menos 0.1 cm",
    "any.required": "La altura es obligatoria",
  }),
}).messages({
  "object.base": "Las dimensiones son obligatorias",
  "any.required": "Las dimensiones son obligatorias",
});

const attributesSchema = Joi.object({
  size: Joi.string().trim().max(40).messages({
    "string.max": "El tamaño no puede tener más de 40 caracteres",
  }),
  shade: Joi.string().trim().max(40).messages({
    "string.max": "El tono no puede tener más de 40 caracteres",
  }),
  volume: Joi.string().trim().max(40).messages({
    "string.max": "El volumen no puede tener más de 40 caracteres",
  }),
});

const variantSchema = Joi.object({
  sku: Joi.string().trim().uppercase().pattern(SKU_PATTERN).required().messages({
    "string.pattern.base": "El SKU debe ser alfanumérico en mayúsculas (3 a 32 caracteres)",
    "any.required": "El SKU es obligatorio",
  }),
  name: Joi.string().trim().min(1).max(120).required().messages({
    "string.empty": "El nombre de la variante es obligatorio",
    "string.min": "El nombre de la variante es obligatorio",
    "string.max": "El nombre de la variante no puede tener más de 120 caracteres",
    "any.required": "El nombre de la variante es obligatorio",
  }),
  attributes: attributesSchema.default({}),
  price: Joi.number().integer().min(0).required().messages({
    "number.base": "El precio es obligatorio",
    "number.integer": "El precio debe ser un entero en centavos",
    "number.min": "El precio no puede ser negativo",
    "any.required": "El precio es obligatorio",
  }),
  listPrice: listPriceSchema,
  weightGrams: Joi.number().integer().min(1).required().messages({
    "number.base": "El peso es obligatorio",
    "number.integer": "El peso debe ser un entero en gramos",
    "number.min": "El peso debe ser de al menos 1 gramo",
    "any.required": "El peso es obligatorio",
  }),
  dimensionsCm: dimensionsSchema.required(),
  isActive: Joi.boolean().messages({
    "boolean.base": "El estado activo debe ser verdadero o falso",
  }),
})
  .custom(validateListPriceAboveSalePrice)
  .messages(listPriceMessages);

/**
 * `initialStock` es WRITE-ONLY y solo existe en esta variante del schema
 * (creación de producto): nunca se admite al agregar/editar una variante por
 * separado (`createVariantSchema`/`updateVariantSchema`, sin esta clave, la
 * descartan por `stripUnknown`) ni se devuelve en ninguna lectura — ver
 * §"Alta de stock híbrida" de ECOMMERCE_ARCHITECTURE_GUIDELINES.md.
 */
const createProductVariantSchema = variantSchema.keys({
  initialStock: Joi.number().integer().min(0).max(100_000).messages({
    "number.base": "La existencia inicial debe ser un número entero",
    "number.integer": "La existencia inicial debe ser un número entero",
    "number.min": "La existencia inicial no puede ser negativa",
    "number.max": "La existencia inicial no puede superar 100,000 unidades",
  }),
});

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).required().messages({
    "string.empty": "El nombre es obligatorio",
    "string.min": "El nombre es obligatorio",
    "string.max": "El nombre no puede tener más de 160 caracteres",
    "any.required": "El nombre es obligatorio",
  }),
  description: Joi.string().trim().min(1).max(5000).required().messages({
    "string.empty": "La descripción es obligatoria",
    "string.min": "La descripción es obligatoria",
    "string.max": "La descripción no puede tener más de 5000 caracteres",
    "any.required": "La descripción es obligatoria",
  }),
  shortDescription: Joi.string().trim().max(300).allow("").messages({
    "string.max": "La descripción corta no puede tener más de 300 caracteres",
  }),
  categoryId: Joi.string().hex().length(24).required().messages({
    "string.hex": "La categoría no es válida",
    "string.length": "La categoría no es válida",
    "any.required": "Elige una categoría",
  }),
  badgeId: badgeIdSchema,
  channel: Joi.string()
    .valid(...Object.values(ProductChannel))
    .messages({
      "any.only": "El canal no es válido",
    }),
  content: contentSchema,
  variants: Joi.array()
    .items(createProductVariantSchema)
    .min(1)
    .unique((a, b) => a.sku === b.sku)
    .required()
    .messages({
      "array.unique": "Hay SKUs repetidos entre las variantes enviadas",
      "array.min": "El producto necesita al menos una variante",
      "any.required": "El producto necesita al menos una variante",
    }),
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).messages({
    "string.empty": "El nombre es obligatorio",
    "string.min": "El nombre es obligatorio",
    "string.max": "El nombre no puede tener más de 160 caracteres",
  }),
  description: Joi.string().trim().min(1).max(5000).messages({
    "string.empty": "La descripción es obligatoria",
    "string.min": "La descripción es obligatoria",
    "string.max": "La descripción no puede tener más de 5000 caracteres",
  }),
  shortDescription: Joi.string().trim().max(300).allow("").messages({
    "string.max": "La descripción corta no puede tener más de 300 caracteres",
  }),
  categoryId: Joi.string().hex().length(24).messages({
    "string.hex": "La categoría no es válida",
    "string.length": "La categoría no es válida",
  }),
  badgeId: badgeIdSchema,
  status: Joi.string().valid("draft", "active", "archived").messages({
    "any.only": "El estado no es válido",
  }),
  channel: Joi.string()
    .valid(...Object.values(ProductChannel))
    .messages({
      "any.only": "El canal no es válido",
    }),
  content: contentSchema,
}).min(1);

const createVariantSchema = variantSchema;

const updateVariantSchema = Joi.object({
  sku: Joi.string().trim().uppercase().pattern(SKU_PATTERN).messages({
    "string.pattern.base": "El SKU debe ser alfanumérico en mayúsculas (3 a 32 caracteres)",
  }),
  name: Joi.string().trim().min(1).max(120).messages({
    "string.empty": "El nombre de la variante es obligatorio",
    "string.min": "El nombre de la variante es obligatorio",
    "string.max": "El nombre de la variante no puede tener más de 120 caracteres",
  }),
  attributes: attributesSchema,
  price: Joi.number().integer().min(0).messages({
    "number.integer": "El precio debe ser un entero en centavos",
    "number.min": "El precio no puede ser negativo",
  }),
  listPrice: listPriceSchema,
  weightGrams: Joi.number().integer().min(1).messages({
    "number.integer": "El peso debe ser un entero en gramos",
    "number.min": "El peso debe ser de al menos 1 gramo",
  }),
  dimensionsCm: dimensionsSchema,
  isActive: Joi.boolean().messages({
    "boolean.base": "El estado activo debe ser verdadero o falso",
  }),
})
  .min(1)
  .custom(validateListPriceAboveSalePrice)
  .messages(listPriceMessages);

export { createProductSchema, updateProductSchema, createVariantSchema, updateVariantSchema };
