import Joi from "joi";
import { ProductStatus, BadgeColor } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

/**
 * Query schemas de listado, uno por vertical y audiencia. Cada uno extiende
 * `listQueryBaseSchema` — sin eso, `stripUnknown` borraría page/limit/sort/
 * search antes de que `parseListQuery` los vea.
 */
const objectId = Joi.string().hex().length(24);

const listCategoriesQuerySchema = listQueryBaseSchema.keys({
  parentId: objectId.allow(null),
  isActive: Joi.boolean(),
});

const listProductsQuerySchema = listQueryBaseSchema.keys({
  categoryId: objectId,
  status: Joi.string().valid(...Object.values(ProductStatus)),
  minPrice: Joi.number().integer().min(0),
  maxPrice: Joi.number().integer().min(0),
});

const listBadgesQuerySchema = listQueryBaseSchema.keys({
  color: Joi.string().valid(...Object.values(BadgeColor)),
});

const publicCategoryQuerySchema = Joi.object({});

const publicProductQuerySchema = listQueryBaseSchema.keys({
  category: Joi.string().trim().lowercase().max(80),
  minPrice: Joi.number().integer().min(0),
  maxPrice: Joi.number().integer().min(0),
});

export {
  listCategoriesQuerySchema,
  listProductsQuerySchema,
  listBadgesQuerySchema,
  publicCategoryQuerySchema,
  publicProductQuerySchema,
};
