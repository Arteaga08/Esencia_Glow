import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Exige el header `Idempotency-Key` en el checkout y lo valida como UUID v4
 * — NO se soporta vía `validate(schema, "headers")`: `stripUnknown` sobre
 * headers borraría cookies/`content-type` (ver plan de 1.5 §C). Deja el
 * valor en `req.idempotencyKey` (tipado en `types/express.d.ts`).
 */
function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers["idempotency-key"];
  const key = Array.isArray(header) ? header[0] : header;

  if (!key || !UUID_V4_PATTERN.test(key)) {
    next(new AppError("El header Idempotency-Key es obligatorio y debe ser un UUID v4.", 400));
    return;
  }

  req.idempotencyKey = key;
  next();
}

export { requireIdempotencyKey };
