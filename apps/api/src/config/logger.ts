import pino from "pino";
import { env } from "./env.js";

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
  transport: env.isDevelopment
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
    : undefined,
});

export { logger, redact };
