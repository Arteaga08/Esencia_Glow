import Joi from "joi";

/**
 * `slug` nunca aparece aquí: se deriva de `name` en el service (slugify.ts).
 * `parentId` null o ausente = categoría raíz.
 */
const objectId = Joi.string().hex().length(24);

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().max(500).allow(""),
  parentId: objectId.allow(null),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  description: Joi.string().trim().max(500).allow(""),
  parentId: objectId.allow(null),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);

/**
 * `parentId: null` reordena las categorías raíz; un id reordena las
 * subcategorías de esa categoría. `ids` debe traer exactamente el conjunto de
 * hermanos bajo ese padre — category.service.ts valida eso, aquí solo se
 * valida la forma.
 */
const reorderCategoriesSchema = Joi.object({
  parentId: objectId.allow(null).required(),
  ids: Joi.array().items(objectId).min(1).required(),
});

export { createCategorySchema, updateCategorySchema, reorderCategoriesSchema };
