import * as Sentry from "@sentry/node";
import type { Breadcrumb, ErrorEvent } from "@sentry/node";
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
 * Categorías de breadcrumb que se descartan completas: las de HTTP llevan la
 * URL de cada llamada saliente (la de Pwned Passwords trae el prefijo SHA-1 de
 * la contraseña en el path) y las de consola pueden traer cualquier dato que se
 * haya impreso. El resto sale, pero sin query en su `data.url`.
 */
const DROPPED_BREADCRUMB_CATEGORIES = new Set(["http", "fetch", "console"]);

/** Quita query y fragmento: `?search=<correo>` no debe salir del servidor. */
function stripUrlQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category && DROPPED_BREADCRUMB_CATEGORIES.has(breadcrumb.category)) return null;
  if (breadcrumb.type === "http") return null;
  if (breadcrumb.data && typeof breadcrumb.data.url === "string") {
    breadcrumb.data.url = stripUrlQuery(breadcrumb.data.url);
  }
  return breadcrumb;
}

/**
 * Red de seguridad antes de enviar: el evento de un error capturado a mano no
 * trae request, pero si alguna integración lo agregara, cookies, cabeceras,
 * cuerpos y la query de la URL nunca deben salir del servidor. Los breadcrumbs
 * pasan por el mismo filtro que `beforeBreadcrumb` por si alguno llegó antes de
 * que el hook existiera.
 */
function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripUrlQuery(event.request.url);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);
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
    dataCollection: {
      userInfo: false,
      httpBodies: [],
      urlQueryParams: false,
      // Explícito aunque no se active LocalVariables: en @sentry/node 11 el
      // default es `true`, y una variable local puede ser un correo o un token.
      stackFrameVariables: false,
    },
    beforeBreadcrumb: scrubBreadcrumb,
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

export { initSentry, reportLoggedError, flushSentry, scrubEvent, scrubBreadcrumb };
