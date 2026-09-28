import { listQueryBaseSchema } from "./list-query.validator.js";

/**
 * `GET /admin/customers` (Milestone 2.6). Sin filtros propios más allá de
 * page/limit/sort/search — el listado siempre es `{role: customer}`, eso no
 * es un filtro que el cliente HTTP pueda elegir.
 */
const listAdminCustomersQuerySchema = listQueryBaseSchema.keys({});

export { listAdminCustomersQuerySchema };
