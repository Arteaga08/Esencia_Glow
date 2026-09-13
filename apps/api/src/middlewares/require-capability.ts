import type { NextFunction, Request, Response } from "express";
import type { UserCapabilities } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";
import { resolveCapabilities } from "../services/capabilities.service.js";

/**
 * Factory hermana de `restrictTo` (Milestone 1.7.1): en vez de un rol fijo,
 * exige una capacidad DERIVADA en lectura. Corre siempre después de
 * `protect`. NO se monta en ninguna ruta todavía — 1.7.3 la conecta a los
 * endpoints de la suscriptora (mismo precedente que `admin-inventory.routes.ts`,
 * cuyo reserve/commit se construyó y probó a nivel de service antes de tener
 * superficie HTTP).
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
