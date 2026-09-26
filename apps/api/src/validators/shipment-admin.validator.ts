import Joi from "joi";
import { SHIPMENT_QUEUES } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

/**
 * `GET /admin/shipments` (Milestone 2.4): `queue` es obligatorio — cada
 * sección del panel es su propia página del listado con una sola cola fija
 * (mismo criterio que `?group=` en `use-order-group.ts`), nunca "todas las
 * colas a la vez".
 */
const listAdminShipmentsQuerySchema = listQueryBaseSchema.keys({
  queue: Joi.string()
    .valid(...SHIPMENT_QUEUES)
    .required(),
});

export { listAdminShipmentsQuerySchema };
