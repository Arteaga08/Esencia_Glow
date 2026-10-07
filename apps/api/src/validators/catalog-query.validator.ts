import Joi from "joi";
import { ProductChannel, ProductStatus, BadgeColor } from "@esencia-glow/shared";
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
  // Solo el listado admin: el catálogo público (publicProductQuerySchema) no
  // acepta esta llave, `stripUnknown` la borraría de todas formas.
  channel: Joi.string().valid(...Object.values(ProductChannel)),
  availableIn: Joi.string().valid("store", "subscription"),
  minPrice: Joi.number().integer().min(0),
  maxPrice: Joi.number().integer().min(0),
});

const listBadgesQuerySchema = listQueryBaseSchema.keys({
  color: Joi.string().valid(...Object.values(BadgeColor)),
});

const listBrandsQuerySchema = listQueryBaseSchema;

const publicCategoryQuerySchema = Joi.object({});

const MAX_BRANDS_PER_QUERY = 10;
const MAX_BRAND_LENGTH = 80;

/**
 * Marcas del filtro: llegan como "Cosrx,Isntree" y salen como `string[]`
 * (Joi entrega el valor ya convertido al controller). Las vacías se ignoran;
 * pasar de 10 marcas o de 80 caracteres por marca es un 400.
 */
const brandListSchema = Joi.string()
  .trim()
  .max(MAX_BRANDS_PER_QUERY * (MAX_BRAND_LENGTH + 1))
  .custom((value: string, helpers) => {
    const brands = [...new Set(value.split(",").map((brand) => brand.trim()).filter(Boolean))];
    if (brands.length > MAX_BRANDS_PER_QUERY || brands.some((brand) => brand.length > MAX_BRAND_LENGTH)) {
      return helpers.error("any.invalid");
    }
    return brands;
  })
  .messages({ "any.invalid": "Máximo 10 marcas de hasta 80 caracteres cada una." });

const publicProductQuerySchema = listQueryBaseSchema.keys({
  category: Joi.string().trim().lowercase().max(80),
  brand: brandListSchema,
  bestseller: Joi.boolean(),
  newArrival: Joi.boolean(),
  onSale: Joi.boolean(),
  minPrice: Joi.number().integer().min(0),
  maxPrice: Joi.number().integer().min(0),
});

/** Facetas del catálogo: categoría, "más vendidos" y/o "ofertas"; marcas y precios los calcula el servidor. */
const publicProductFacetsQuerySchema = Joi.object({
  category: Joi.string().trim().lowercase().max(80),
  bestseller: Joi.boolean(),
  onSale: Joi.boolean(),
});

export {
  listCategoriesQuerySchema,
  listProductsQuerySchema,
  listBadgesQuerySchema,
  listBrandsQuerySchema,
  publicCategoryQuerySchema,
  publicProductQuerySchema,
  publicProductFacetsQuerySchema,
};
