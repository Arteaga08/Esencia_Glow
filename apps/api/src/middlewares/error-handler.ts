import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/app-error.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

/** Normaliza errores conocidos de Mongoose/JWT a un AppError operacional. */
function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof mongoose.Error.ValidationError) {
    const errors: Record<string, string> = {};
    for (const [field, err] of Object.entries(error.errors)) {
      errors[field] = err.message;
    }
    return new AppError("Datos inválidos", 400, errors);
  }

  if (error instanceof mongoose.Error.CastError) {
    return new AppError(`Identificador inválido: ${error.value}`, 400);
  }

  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyValue ?? {})[0] ?? "campo";
    return new AppError(`Ya existe un registro con ese ${field}`, 409);
  }

  if (error instanceof Error && error.name === "JsonWebTokenError") {
    return new AppError("Token inválido", 401);
  }

  if (error instanceof Error && error.name === "TokenExpiredError") {
    return new AppError("Token expirado", 401);
  }

  return new AppError("Algo salió mal", 500);
}

/**
 * Error handler global (4 args). En producción nunca expone stack traces ni
 * detalles internos de errores no operacionales.
 */
function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const isOperational = error instanceof AppError;
  const normalized = normalizeError(error);

  if (!isOperational) {
    logger.error({ err: error, path: req.originalUrl }, "Error no operacional");
  }

  const message =
    normalized.statusCode >= 500 && env.isProduction ? "Algo salió mal" : normalized.message;

  res.status(normalized.statusCode).json({
    status: normalized.statusCode >= 500 ? "error" : "fail",
    message,
    ...(normalized.errors ? { errors: normalized.errors } : {}),
    ...(env.isDevelopment && error instanceof Error ? { stack: error.stack } : {}),
  });
}

export { errorHandler };
