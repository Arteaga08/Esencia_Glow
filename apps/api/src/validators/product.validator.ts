import Joi from "joi";
import { SKU_PATTERN } from "../models/product-variant.schema.js";

/**
 * `slug` y `minPrice` nunca aparecen: se derivan en el service. Las variantes
 * se crean/editan por subrutas propias (createVariantSchema/updateVariantSchema),
 * nunca reemplazando el array completo — reemplazar regenera los `_id` de
 * Mongoose y rompería silenciosamente las referencias de inventario (1.4).
 */

const dimensionsSchema = Joi.object({
  length: Joi.number().min(0.1).required(),
  width: Joi.number().min(0.1).required(),
  height: Joi.number().min(0.1).required(),
});

const attributesSchema = Joi.object({
  size: Joi.string().trim().max(40),
  shade: Joi.string().trim().max(40),
  volume: Joi.string().trim().max(40),
});

const variantSchema = Joi.object({
  sku: Joi.string().trim().uppercase().pattern(SKU_PATTERN).required().messages({
    "string.pattern.base": "El SKU debe ser alfanumérico en mayúsculas (3 a 32 caracteres)",
  }),
  name: Joi.string().trim().min(1).max(120).required(),
  attributes: attributesSchema.default({}),
  price: Joi.number().integer().min(0).required().messages({
    "number.integer": "El precio debe ser un entero en centavos",
  }),
  weightGrams: Joi.number().integer().min(1).required(),
  dimensionsCm: dimensionsSchema.required(),
  isActive: Joi.boolean(),
});

/**
 * `initialStock` es WRITE-ONLY y solo existe en esta variante del schema
 * (creación de producto): nunca se admite al agregar/editar una variante por
 * separado (`createVariantSchema`/`updateVariantSchema`, sin esta clave, la
 * descartan por `stripUnknown`) ni se devuelve en ninguna lectura — ver
 * §"Alta de stock híbrida" de ECOMMERCE_ARCHITECTURE_GUIDELINES.md.
 */
const createProductVariantSchema = variantSchema.keys({
  initialStock: Joi.number().integer().min(0).max(100_000),
});

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).required(),
  description: Joi.string().trim().min(1).max(5000).required(),
  shortDescription: Joi.string().trim().max(300).allow(""),
  categoryId: Joi.string().hex().length(24).required(),
  badgeId: Joi.string().hex().length(24).allow(null),
  variants: Joi.array()
    .items(createProductVariantSchema)
    .min(1)
    .unique((a, b) => a.sku === b.sku)
    .required()
    .messages({
      "array.unique": "Hay SKUs repetidos entre las variantes enviadas",
      "array.min": "El producto necesita al menos una variante",
    }),
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160),
  description: Joi.string().trim().min(1).max(5000),
  shortDescription: Joi.string().trim().max(300).allow(""),
  categoryId: Joi.string().hex().length(24),
  badgeId: Joi.string().hex().length(24).allow(null),
  status: Joi.string().valid("draft", "active", "archived"),
}).min(1);

const createVariantSchema = variantSchema;

const updateVariantSchema = Joi.object({
  sku: Joi.string().trim().uppercase().pattern(SKU_PATTERN),
  name: Joi.string().trim().min(1).max(120),
  attributes: attributesSchema,
  price: Joi.number().integer().min(0),
  weightGrams: Joi.number().integer().min(1),
  dimensionsCm: dimensionsSchema,
  isActive: Joi.boolean(),
}).min(1);

export { createProductSchema, updateProductSchema, createVariantSchema, updateVariantSchema };
