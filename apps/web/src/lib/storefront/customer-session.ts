import "server-only";
import { cache } from "react";
import { getSessionState } from "../session";

/**
 * Estado de la sesión de la clienta para Server Components de la tienda
 * (`SessionState`: autenticada, anónima o no disponible). Valida contra
 * `GET /auth/me` (no solo que exista la cookie) y, con `cache`, se consulta una
 * sola vez por petición aunque la pidan el layout y la página a la vez.
 */
const getCustomerSession = cache(getSessionState);

export { getCustomerSession };
