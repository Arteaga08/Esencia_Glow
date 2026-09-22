import type { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/async-handler.js";
import { AppError } from "../utils/app-error.js";
import { sendResponse } from "../utils/send-response.js";

/** `GET /health` — liveness pura: el proceso responde, nada más. Nunca toca
 * Mongo, para no reportar "caído" solo porque la DB tarda. */
const liveness = (_req: Request, res: Response): void => {
  sendResponse(res, 200, "OK", { uptime: process.uptime() });
};

/** `GET /health/ready` — readiness: confirma que Mongo está realmente
 * disponible antes de que Railway le mande tráfico a esta instancia.
 * `readyState !== 1` es la comprobación barata (conexión caída/conectando);
 * el `ping` al admin cubre el caso más raro de una conexión que Mongoose
 * sigue marcando "conectada" pero que ya no responde del lado del cluster. */
const readiness = asyncHandler(async (_req: Request, res: Response) => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new AppError("Base de datos no disponible", 503);
  }

  try {
    await mongoose.connection.db.admin().ping();
  } catch {
    // Conexión marcada "conectada" por Mongoose pero que ya no responde del
    // lado del cluster (p. ej. failover en curso) — sigue siendo un 503 de
    // "no listo", nunca un 500 de bug no esperado.
    throw new AppError("Base de datos no disponible", 503);
  }

  sendResponse(res, 200, "OK", { uptime: process.uptime() });
});

export { liveness, readiness };
