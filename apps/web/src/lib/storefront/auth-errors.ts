import type { ErrorCode } from "@esencia-glow/shared";
import { ApiRequestError } from "../api";

/**
 * Traduce un fallo de la API a algo que una pantalla pueda pintar. Un solo
 * lugar para que 401/403/429/red digan lo mismo en todas las pantallas.
 */
type FailureKind = "network" | "invalid" | "unauthorized" | "forbidden" | "notFound" | "conflict" | "rateLimited" | "server";

interface Failure {
  kind: FailureKind;
  message: string;
  /** Errores por campo del API (`errors`), con las mismas claves que los inputs. */
  fieldErrors: Record<string, string>;
  status?: number;
  /** Código estable del API (p. ej. correo sin verificar); ver `ErrorCode` en shared. */
  code?: ErrorCode;
}

const NETWORK_ERROR = "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
const SERVER_ERROR = "Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.";
const RATE_LIMIT_ERROR = "Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

function kindOf(status: number): FailureKind {
  if (status === 400) return "invalid";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 429) return "rateLimited";
  return "server";
}

function classifyError(error: unknown): Failure {
  if (!(error instanceof ApiRequestError)) return { kind: "network", message: NETWORK_ERROR, fieldErrors: {} };

  const kind = kindOf(error.status);
  const message = kind === "server" ? SERVER_ERROR : kind === "rateLimited" ? error.message || RATE_LIMIT_ERROR : error.message;
  return { kind, message, fieldErrors: error.fieldErrors ?? {}, status: error.status, ...(error.code ? { code: error.code } : {}) };
}

export { classifyError, NETWORK_ERROR, SERVER_ERROR, RATE_LIMIT_ERROR };
export type { Failure, FailureKind };
