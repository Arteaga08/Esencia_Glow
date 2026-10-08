import pino from "pino";
import { env } from "./env.js";
import { reportLoggedError } from "./sentry.js";

/** Nivel numérico de pino para `error` (`fatal` es 60). */
const PINO_ERROR_LEVEL = 50;

/**
 * Reglas de redacción, exportadas aparte del logger para que
 * `config/http-logger.ts` y sus tests puedan reconstruirlas sobre un logger
 * propio (con su propio destino) sin duplicar la lista a mano — una lista
 * copiada se desincroniza en el primer campo nuevo que alguien olvide sumar
 * en los dos lados.
 */
const redact = {
  paths: [
    "req.headers.cookie",
    "req.headers.authorization",
    "*.password",
    "*.token",
    "*.accessToken",
    "*.refreshToken",
    "*.jwt",
    "*.secret",
    "*.email",
    "*.rfc",
    "*.phone",
    "*.clientSecret",
    "*.client_secret",
    "*.twoFactorCode",
    'req.headers["stripe-signature"]',
  ],
  censor: "[redacted]",
};

/**
 * Logger estructurado. Redacta PII y secretos conocidos en cualquier log —
 * nunca deben aparecer, ni siquiera en logs de depuración. `debug` solo en dev.
 */
const logger = pino({
  level: env.isDevelopment ? "debug" : "info",
  redact,
  // Todo `logger.error`/`fatal` (jobs, servicios, handler de errores) llega a
  // Sentry desde este único punto; así no hay que instrumentar cada llamada.
  hooks: {
    logMethod(args, method, level) {
      if (level >= PINO_ERROR_LEVEL) reportLoggedError(args);
      method.apply(this, args);
    },
  },
  transport: env.isDevelopment
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
    : undefined,
});

export { logger, redact };
