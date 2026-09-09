import type { NextFunction, Request, Response } from "express";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recorre recursivamente objetos y arrays anidados eliminando claves que
 * empiecen con "$" o contengan ".", y bloquea prototype pollution. Express 5
 * vuelve `req.query` de solo lectura: se muta en sitio, nunca se reasigna.
 */
function sanitizeInPlace(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) sanitizeInPlace(item);
    return;
  }
  if (!isPlainObject(value)) return;

  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) {
      delete value[key];
      continue;
    }
    sanitizeInPlace(value[key]);
  }
}

function mongoSanitize(req: Request, _res: Response, next: NextFunction): void {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params);
  sanitizeInPlace(req.query);
  next();
}

export { mongoSanitize };
