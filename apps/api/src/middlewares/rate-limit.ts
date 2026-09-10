import rateLimit, { MemoryStore, type Options } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message: string;
}

/**
 * Factory de rate limiters por acción sensible. No-op fuera de producción
 * para no bloquear desarrollo ni tests. `MemoryStore` explícito por limiter
 * (no compartido) para poder resetear entre tests; migrar a Redis es el
 * disparador al escalar a más de una instancia.
 *
 * Rutas admin nunca pasan por aquí: su barrera es auth + rol, no throttling.
 */
function createRateLimiter(config: RateLimiterConfig) {
  if (!env.isProduction) {
    return (_req: Request, _res: Response, next: NextFunction): void => next();
  }

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MemoryStore(),
    message: { status: "fail", message: config.message },
  } satisfies Partial<Options>);
}

/** Backstop global: cubre cualquier ruta que no tenga un limiter dedicado. */
const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Demasiadas solicitudes, intenta de nuevo más tarde.",
});

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de inicio de sesión, intenta de nuevo más tarde.",
});

/**
 * Única excepción a "las rutas admin no llevan throttling": el costo de un
 * upload no es la consulta, es la CPU que `sharp` gasta decodificando y
 * reencodeando. Cubre las rutas de imagen del catálogo (Milestone 1.3).
 */
const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Demasiadas subidas de imagen, intenta de nuevo más tarde.",
});

/** Endpoints públicos de catálogo: anti-scraping, no anti-abuso de sesión. */
const catalogRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Demasiadas solicitudes, intenta de nuevo más tarde.",
});

export { createRateLimiter, globalRateLimiter, loginRateLimiter, uploadRateLimiter, catalogRateLimiter };
