import type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from "@esencia-glow/shared";
import { API_URL } from "./config";

/**
 * Error normalizado a partir de una `ApiErrorResponse` — listo para mostrar
 * en un toast o un mensaje de formulario, siempre en español porque así lo
 * devuelve la API.
 */
class ApiRequestError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: number, response: ApiErrorResponse) {
    super(response.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.fieldErrors = response.errors;
  }
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** `credentials: "include"` solo en llamadas que de verdad requieren cookies. */
  authenticated?: boolean;
}

/**
 * Wrapper tipado sobre el contrato `{ status, message, data, meta? }` que
 * arma `sendResponse` (apps/api/src/utils/send-response.ts). Nunca se
 * redefine el DTO aquí — los tipos vienen de `@esencia-glow/shared`.
 */
async function apiRequest<TData>(
  path: string,
  { authenticated = false, body, headers, ...init }: ApiRequestOptions = {},
): Promise<ApiSuccessResponse<TData>> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    ...(authenticated ? { credentials: "include" } : {}),
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<TData> | null;

  if (!response.ok || !payload || payload.status !== "success") {
    const fallback: ApiErrorResponse = {
      status: "error",
      message: "Ocurrió un error inesperado. Intenta de nuevo.",
    };
    throw new ApiRequestError(response.status, (payload as ApiErrorResponse) ?? fallback);
  }

  return payload;
}

export { apiRequest, ApiRequestError };
