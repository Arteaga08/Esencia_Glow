import Joi from "joi";
import { MAX_EDITION_ITEMS } from "@esencia-glow/shared";

/**
 * `status`/`publishedAt`/`publishedBy`/`firstBilledAt` nunca aparecen: se
 * gobiernan por los endpoints dedicados de publicar/despublicar, nunca por
 * un PATCH directo. `items` se reemplaza completo — sin sub-CRUD por línea,
 * calco de bundle.validator.ts.
 */
const objectId = Joi.string().hex().length(24);

const editionItemSchema = Joi.object({
  productId: objectId.required(),
  variantId: objectId.required(),
  quantity: Joi.number().integer().min(1).required(),
});

const createSubscriptionEditionSchema = Joi.object({
  planId: objectId.required(),
  cycleYear: Joi.number().integer().min(2024).max(2100).required(),
  cycleMonth: Joi.number().integer().min(1).max(12).required(),
  title: Joi.string().trim().min(1).max(160).required(),
  description: Joi.string().trim().max(3000).allow(""),
});

const updateSubscriptionEditionSchema = Joi.object({
  title: Joi.string().trim().min(1).max(160),
  description: Joi.string().trim().max(3000).allow(""),
  items: Joi.array()
    .items(editionItemSchema)
    .max(MAX_EDITION_ITEMS)
    .unique((a, b) => a.productId === b.productId && a.variantId === b.variantId)
    .messages({
      "array.unique": "Hay productos repetidos entre los ítems enviados",
      "array.max": `La edición no puede tener más de ${MAX_EDITION_ITEMS} productos`,
    }),
}).min(1);

export { createSubscriptionEditionSchema, updateSubscriptionEditionSchema };
