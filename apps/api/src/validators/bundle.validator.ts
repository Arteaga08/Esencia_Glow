import Joi from "joi";
import { BundleStatus } from "@esencia-glow/shared";
import {
  badgeIdSchema,
  contentSchema,
  listPriceMessages,
  listPriceSchema,
  validateListPriceAboveSalePrice,
} from "./catalog-content.validator.js";

/**
 * `slug` y `stockCache` nunca aparecen: se derivan en el service. `items` se
 * reemplaza completo en cada `PATCH` (no hay sub-CRUD por línea) — el
 * dashboard construye la lista completa al armar el paquete.
 *
 * `content`/`listPrice`/`badgeId` (Milestone 2.2.3) son los mismos tres
 * campos que `Product` tiene desde 2.2.1, mismas piezas de validación
 * (catalog-content.validator.ts) — un paquete se vende como un producto más
 * en el storefront y necesita la misma vitrina editorial.
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
  listPrice: listPriceSchema,
  badgeId: badgeIdSchema,
  content: contentSchema,
  items: itemsSchema.required(),
})
  .custom(validateListPriceAboveSalePrice)
  .messages(listPriceMessages);

const updateBundleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160),
  description: Joi.string().trim().min(1).max(3000),
  price: Joi.number().integer().min(0),
  listPrice: listPriceSchema,
  badgeId: badgeIdSchema,
  content: contentSchema,
  items: itemsSchema,
  status: Joi.string().valid(...Object.values(BundleStatus)),
})
  .min(1)
  .custom(validateListPriceAboveSalePrice)
  .messages(listPriceMessages);

export { createBundleSchema, updateBundleSchema };
