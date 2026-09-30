import type { NextFunction, Request, Response } from "express";
import type { ObjectSchema } from "joi";
import { AppError } from "../utils/app-error.js";
import { replaceRequestQuery } from "../utils/replace-request-query.js";

type ValidationSource = "body" | "params" | "query";

/**
 * Middleware factory de validación con Joi. `stripUnknown` descarta cualquier
 * campo no declarado en el schema (BACKEND_SECURITY_GUIDELINES.md checklist)
 * — así un payload nunca cuela `role` o `emailVerified` por accidente.
 *
 * `req.query` es un getter en Express 5 (se re-parsea en cada acceso), así que
 * el resultado validado se fija con `replaceRequestQuery`; mutar el objeto
 * que devuelve el getter se perdería antes de llegar al controller.
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
      replaceRequestQuery(req, value);
    } else {
      req[source] = value;
    }
    next();
  };
}

export { validate };
