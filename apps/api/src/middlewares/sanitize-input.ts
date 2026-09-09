import type { NextFunction, Request, Response } from "express";
import xss from "xss";

/**
 * Campos de credencial que NO se sanean: alterar el string cambiaría el
 * secreto real (una contraseña con "<" en el medio se rompería silenciosamente).
 */
const CREDENTIAL_KEYS = new Set(["password", "newPassword", "currentPassword", "token", "code"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Escapa scripts recursivamente en todo el body (objetos y arrays anidados),
 * salvo en campos de credencial. Ver BACKEND_SECURITY_GUIDELINES.md §5.
 */
function sanitizeValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key && CREDENTIAL_KEYS.has(key)) return value;
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = sanitizeValue(childValue, childKey);
    }
    return result;
  }
  return value;
}

function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (isPlainObject(req.body)) {
    req.body = sanitizeValue(req.body) as Request["body"];
  }
  next();
}

export { sanitizeInput };
