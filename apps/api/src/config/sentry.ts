import * as Sentry from "@sentry/node";
import type { ErrorEvent } from "@sentry/node";
import { env } from "./env.js";

/** Tiempo máximo (ms) que se espera a que Sentry vacíe su cola antes de morir. */
const FLUSH_TIMEOUT_MS = 2_000;

/**
 * Claves de contexto que sí viajan a Sentry junto al error (`orderId`,
 * `accountId`, ...). Es una lista cerrada por forma, no por valor: cualquier
 * otro campo del log (correo, teléfono, cuerpos) se queda solo en pino, que sí
 * lo redacta.
 */
const CONTEXT_ID_KEY = /^[a-z][A-Za-z]*Id$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Red de seguridad antes de enviar: el evento de un error capturado a mano no
 * trae request, pero si alguna integración lo agregara, cookies, cabeceras y
 * cuerpos nunca deben salir del servidor.
 */
function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  delete event.user;
  return event;
}

/**
 * Inicializa Sentry solo si hay DSN. Sin DSN (dev, tests, CI) todas las
 * llamadas a Sentry son no-ops. Solo monitoreo de errores: sin trazas, sin
 * logs, sin variables locales en los frames.
 */
function initSentry(): void {
  if (!env.sentryDsn) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    release: env.sentryRelease,
    dataCollection: { userInfo: false, httpBodies: [] },
    beforeSend: scrubEvent,
  });
}

/**
 * Reenvía a Sentry una llamada `logger.error/fatal` de pino. Se invoca desde
 * el hook del logger con los argumentos tal como llegaron: `(obj, msg)`,
 * `(msg)` o `(err)`. Nunca lanza — un fallo al reportar no puede tumbar el
 * flujo que justamente intentaba registrar un error.
 */
function reportLoggedError(args: unknown[]): void {
  try {
    const [first, second] = args;
    const message =
      typeof first === "string" ? first : typeof second === "string" ? second : undefined;
    const fields = isRecord(first) ? first : {};
    const error = first instanceof Error ? first : fields.err;

    const context: Record<string, unknown> = { message };
    for (const [key, value] of Object.entries(fields)) {
      if (CONTEXT_ID_KEY.test(key) && (typeof value === "string" || typeof value === "number")) {
        context[key] = value;
      }
    }

    Sentry.withScope((scope) => {
      scope.setContext("log", context);
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(message ?? "Error registrado sin mensaje", "error");
      }
    });
  } catch {
    // Silencioso a propósito: ver comentario de la función.
  }
}

/** Vacía la cola de eventos; llamar justo antes de `process.exit` en fallos fatales. */
async function flushSentry(): Promise<void> {
  try {
    await Sentry.flush(FLUSH_TIMEOUT_MS);
  } catch {
    // Mismo criterio que reportLoggedError.
  }
}

export { initSentry, reportLoggedError, flushSentry, scrubEvent };
