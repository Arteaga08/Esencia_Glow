import type { NextFunction, Request, Response } from "express";
import type { ObjectSchema } from "joi";
import { AppError } from "../utils/app-error.js";

type ValidationSource = "body" | "params" | "query";

/**
 * Middleware factory de validación con Joi. `stripUnknown` descarta cualquier
 * campo no declarado en el schema (BACKEND_SECURITY_GUIDELINES.md checklist)
 * — así un payload nunca cuela `role` o `emailVerified` por accidente.
 *
 * `req.query` es de solo lectura en Express 5 (igual que en mongoSanitize):
 * el resultado validado se copia en sitio, nunca se reasigna el objeto.
 */
function validate(schema: ObjectSchema, source: ValidationSource = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors: Record<string, string> = {};
      for (const detail of error.details) {
        const field = detail.path.join(".") || "valor";
        errors[field] = detail.message;
      }
      next(new AppError("Datos inválidos", 400, errors));
      return;
    }

    if (source === "query") {
      for (const key of Object.keys(req.query)) delete req.query[key];
      Object.assign(req.query, value);
    } else {
      req[source] = value;
    }
    next();
  };
}

export { validate };
