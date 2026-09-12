import pino from "pino";
import { env } from "./env.js";

/**
 * Logger estructurado. Redacta PII y secretos conocidos en cualquier log —
 * nunca deben aparecer, ni siquiera en logs de depuración. `debug` solo en dev.
 */
const logger = pino({
  level: env.isDevelopment ? "debug" : "info",
  redact: {
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
      "req.headers[\"stripe-signature\"]",
    ],
    censor: "[redacted]",
  },
  transport: env.isDevelopment
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
    : undefined,
});

export { logger };
