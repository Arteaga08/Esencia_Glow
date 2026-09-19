import Joi from "joi";
import { EditionStatus, SubscriptionShipmentStatus } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

/**
 * Query schemas de listado del módulo de suscripciones — mismo patrón que
 * catalog-query.validator.ts: cada uno extiende `listQueryBaseSchema`, sin
 * lo cual `stripUnknown` borraría page/limit/sort/search.
 */
const objectId = Joi.string().hex().length(24);

const listSubscriptionPlansQuerySchema = listQueryBaseSchema.keys({
  isActive: Joi.boolean(),
});

const listSubscriptionEditionsQuerySchema = listQueryBaseSchema.keys({
  planId: objectId,
  cycleYear: Joi.number().integer().min(2024).max(2100),
  cycleMonth: Joi.number().integer().min(1).max(12),
  status: Joi.string().valid(...Object.values(EditionStatus)),
});

const listSubscriptionShipmentsQuerySchema = listQueryBaseSchema.keys({
  planId: objectId,
  cycleYear: Joi.number().integer().min(2024).max(2100),
  cycleMonth: Joi.number().integer().min(1).max(12),
  status: Joi.string().valid(...Object.values(SubscriptionShipmentStatus)),
  incident: Joi.boolean(),
});

export {
  listSubscriptionPlansQuerySchema,
  listSubscriptionEditionsQuerySchema,
  listSubscriptionShipmentsQuerySchema,
};
