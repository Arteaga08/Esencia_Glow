import Joi from "joi";
import { BundleStatus } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

const listBundlesQuerySchema = listQueryBaseSchema.keys({
  status: Joi.string().valid(...Object.values(BundleStatus)),
});

const publicBundleQuerySchema = listQueryBaseSchema;

export { listBundlesQuerySchema, publicBundleQuerySchema };
