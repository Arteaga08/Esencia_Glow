import type { Response } from "express";
import type { PaginationMeta } from "@esencia-glow/shared";

/**
 * Única forma en que un controller arma una respuesta exitosa — nunca `res.json` a mano.
 */
function sendResponse<TData>(
  res: Response,
  statusCode: number,
  message: string,
  data: TData,
  meta?: PaginationMeta,
): void {
  res.status(statusCode).json({
    status: "success",
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export { sendResponse };
