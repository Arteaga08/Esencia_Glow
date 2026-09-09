import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function extractOrigin(req: Request): string | undefined {
  const origin = req.headers.origin;
  if (origin) return origin;
  const referer = req.headers.referer;
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * Defensa en profundidad anti-CSRF, complementaria a `sameSite: "strict"`.
 * Requests sin Origin/Referer (server-to-server, CLI, health checks) se
 * permiten — no son ataques CSRF de navegador y el auth sigue aplicando.
 */
function verifyOrigin(allowedOrigins: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = extractOrigin(req);
    if (!origin) {
      next();
      return;
    }

    if (!allowedOrigins.includes(origin)) {
      next(new AppError("Origen no permitido", 403));
      return;
    }

    next();
  };
}

export { verifyOrigin };
