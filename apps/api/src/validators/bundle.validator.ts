import Joi from "joi";
import { BundleStatus } from "@esencia-glow/shared";

/**
 * `slug` y `stockCache` nunca aparecen: se derivan en el service. `items` se
 * reemplaza completo en cada `PATCH` (no hay sub-CRUD por línea) — el
 * dashboard construye la lista completa al armar el paquete.
 */
const objectId = Joi.string().hex().length(24);

const bundleItemSchema = Joi.object({
  productId: objectId.required(),
  variantId: objectId.required(),
  quantity: Joi.number().integer().min(1).required(),
});

const itemsSchema = Joi.array()
  .items(bundleItemSchema)
  .min(1)
  .unique((a, b) => a.variantId === b.variantId)
  .messages({
    "array.unique": "Hay variantes repetidas entre los componentes del paquete",
    "array.min": "El paquete necesita al menos un componente",
  });

const createBundleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).required(),
  description: Joi.string().trim().min(1).max(3000).required(),
  price: Joi.number().integer().min(0).required().messages({
    "number.integer": "El precio debe ser un entero en centavos",
  }),
  items: itemsSchema.required(),
});

const updateBundleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160),
  description: Joi.string().trim().min(1).max(3000),
  price: Joi.number().integer().min(0),
  items: itemsSchema,
  status: Joi.string().valid(...Object.values(BundleStatus)),
}).min(1);

export { createBundleSchema, updateBundleSchema };
