import Joi from "joi";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

const objectId = Joi.string().hex().length(24);

/**
 * `GET /admin/subscriptions` (Milestone 2.7a). `status` y `attention` son
 * EXCLUYENTES: `attention` ya es un atajo sobre varios estados a la vez
 * (`past_due`/`incomplete` o cambio de plan pendiente, ver
 * subscription-account-admin.service.ts), así que combinarlo con un
 * `status` puntual no tiene una lectura de negocio clara — se rechaza con
 * 400 en vez de que uno de los dos gane en silencio. `.oxor` (a lo sumo
 * uno) en vez de `.xor` (exactamente uno): un listado sin ninguno de los
 * dos es el caso normal, "todas las cuentas".
 */
const listAdminSubscriptionAccountsQuerySchema = listQueryBaseSchema
  .keys({
    status: Joi.string().valid(...Object.values(SubscriptionStatus)),
    planId: objectId,
    attention: Joi.boolean(),
  })
  .oxor("status", "attention");

export { listAdminSubscriptionAccountsQuerySchema };
