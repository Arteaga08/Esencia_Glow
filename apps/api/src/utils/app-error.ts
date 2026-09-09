/**
 * Error operacional con status HTTP explícito. El errorHandler global lo
 * distingue de un bug no esperado vía `isOperational`.
 */
class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational = true;
  readonly errors: Record<string, string> | undefined;

  constructor(message: string, statusCode: number, errors?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { AppError };
