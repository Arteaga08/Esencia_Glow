import type { NextFunction, Request, Response } from "express";
import type { UserCapabilities } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";
import { resolveCapabilities } from "../services/capabilities.service.js";

/**
 * Factory hermana de `restrictTo` (Milestone 1.7.1): en vez de un rol fijo,
 * exige una capacidad DERIVADA en lectura. Corre siempre después de
 * `protect`. Montada por primera vez en 1.7.3, solo en las acciones de
 * autoservicio que requieren derechos de suscriptora (pausar, deshacer la
 * cancelación, cambiar de plan — ver `subscription.routes.ts`). Ojo: la
 * capacidad `subscriber` solo existe para ACTIVE/PAST_DUE, así que una acción
 * que también deba aceptar `PAUSED` (reanudar, cancelar, tarjeta) NO debe
 * llevarla.
 *
 * Deliberadamente NO es un middleware global: sería una query extra por
 * request en el 95% de rutas a las que la capacidad no les importa.
 * Memoiza en `req.capabilities` — a lo más una consulta por request, y NUNCA
 * entre requests (una caché con TTL sería un bug de entitlement disfrazado
 * de optimización: una cancelación tiene que reflejarse al instante).
 */
function requireCapability(capability: keyof UserCapabilities) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError("No autenticado", 401));
      return;
    }

    req.capabilities ??= await resolveCapabilities(req.user.id);

    if (!req.capabilities[capability]) {
      next(new AppError("No tienes acceso a esta función.", 403));
      return;
    }
    next();
  };
}

export { requireCapability };
