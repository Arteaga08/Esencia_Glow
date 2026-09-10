import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";

/**
 * Verifica el rol de `req.user`. Corre siempre después de `protect`
 * (BACKEND_SECURITY_GUIDELINES.md §3): `router.use(protect, restrictTo("admin"))`.
 */
function restrictTo(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError("No tienes permiso para realizar esta acción", 403));
      return;
    }
    next();
  };
}

export { restrictTo };
