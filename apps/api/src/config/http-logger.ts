import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";

/**
 * Excluye `/health*`: Railway pega ahí cada pocos segundos y ensuciaría los
 * logs con ruido que no aporta nada al debug de un incidente real.
 */
const ignoreHealthChecks = (req: { url?: string }): boolean =>
  (req.url ?? "").startsWith("/api/v1/health");

/**
 * Construye el middleware de log de requests. Recibe `loggerInstance` como
 * parámetro opcional (en vez de usar directamente el singleton de
 * `config/logger.ts`) solo para que los tests puedan pasar un logger propio
 * con su propio destino capturable — un logger hijo de pino-http comparte
 * el destino físico de su padre, así que no hay forma de interceptar la
 * salida real del singleton sin esto. En producción se llama sin
 * argumentos y usa el logger/destino reales.
 */
function buildHttpLogger(loggerInstance: Logger = logger) {
  return pinoHttp({
    logger: loggerInstance,
    autoLogging: { ignore: ignoreHealthChecks },
  });
}

/**
 * Log estructurado de cada request (Milestone 1.10 — sin esto, un incidente
 * en producción no deja rastro de qué se pidió). Reusa el `logger` de
 * `config/logger.ts` para heredar su `redact` (cookie/authorization/
 * stripe-signature) sin duplicarlo aquí. Nunca loguea el body (pino-http no
 * lo serializa por default; no se le agrega un serializer que sí lo haga).
 */
const httpLogger = buildHttpLogger();

export { httpLogger, buildHttpLogger };
