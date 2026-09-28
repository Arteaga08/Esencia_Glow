import Joi from "joi";
import { TopCustomersPeriod, TopCustomersSort } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

/**
 * `GET /admin/customers` (Milestone 2.6). Sin filtros propios más allá de
 * page/limit/sort/search — el listado siempre es `{role: customer}`, eso no
 * es un filtro que el cliente HTTP pueda elegir.
 */
const listAdminCustomersQuerySchema = listQueryBaseSchema.keys({});

/**
 * `GET /admin/customers/top` (Milestone 2.6.1). Ambos parámetros son
 * opcionales; los defaults (mes en curso, por monto) los aplica el
 * controlador, no Joi: en Express 5 `req.query` se vuelve a parsear en cada
 * acceso, así que un `.default()` aquí nunca llegaría al handler.
 */
const topCustomersQuerySchema = Joi.object({
  period: Joi.string()
    .valid(...Object.values(TopCustomersPeriod)),
  sortBy: Joi.string()
    .valid(...Object.values(TopCustomersSort)),
});

export { listAdminCustomersQuerySchema, topCustomersQuerySchema };
