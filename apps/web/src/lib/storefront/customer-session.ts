import "server-only";
import { cache } from "react";
import { getSession } from "../session";

/**
 * Sesión de la clienta para Server Components de la tienda. Valida contra
 * `GET /auth/me` (no solo que exista la cookie) y, con `cache`, se consulta una
 * sola vez por petición aunque la pidan el layout y la página a la vez.
 */
const getCustomerSession = cache(getSession);

export { getCustomerSession };
