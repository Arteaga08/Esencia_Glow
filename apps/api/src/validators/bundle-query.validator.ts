import Joi from "joi";
import { BundleStatus } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

const listBundlesQuerySchema = listQueryBaseSchema.keys({
  status: Joi.string().valid(...Object.values(BundleStatus)),
});

const publicBundleQuerySchema = listQueryBaseSchema.keys({
  minPrice: Joi.number().integer().min(0),
  maxPrice: Joi.number().integer().min(0),
});

/** Sin filtros: el rango lo calcula el servidor sobre los paquetes publicados. */
const publicBundleFacetsQuerySchema = Joi.object({});

export { listBundlesQuerySchema, publicBundleQuerySchema, publicBundleFacetsQuerySchema };
