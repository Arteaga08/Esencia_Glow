import type { ErrorCode } from "@esencia-glow/shared";

/**
 * Error operacional con status HTTP explícito. El errorHandler global lo
 * distingue de un bug no esperado vía `isOperational`.
 */
class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational = true;
  readonly errors: Record<string, string> | undefined;
  readonly code: ErrorCode | undefined;

  constructor(message: string, statusCode: number, errors?: Record<string, string>, code?: ErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { AppError };
