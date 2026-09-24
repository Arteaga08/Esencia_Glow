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

/** Valores de query aceptados por `apiRequest`/`buildQueryString` — `undefined`
 * y `""` se omiten (no mandar `?page=` vacío), no hay forma de mandar arrays. */
type QueryValue = string | number | boolean | undefined;
type QueryParams = Record<string, QueryValue>;

function buildQueryString(query?: QueryParams): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  /** `FormData` (subida de imágenes) viaja tal cual, sin `Content-Type` a
   * mano — el navegador arma el boundary del multipart. Cualquier otro valor
   * se serializa a JSON. */
  body?: unknown | FormData;
  /** `credentials: "include"` solo en llamadas que de verdad requieren cookies. */
  authenticated?: boolean;
  /** Query params tipados — se agregan al path, nunca al body. */
  query?: QueryParams;
}

/**
 * Wrapper tipado sobre el contrato `{ status, message, data, meta? }` que
 * arma `sendResponse` (apps/api/src/utils/send-response.ts). Nunca se
 * redefine el DTO aquí — los tipos vienen de `@esencia-glow/shared`.
 */
async function apiRequest<TData, TMeta = never>(
  path: string,
  { authenticated = false, body, query, headers, ...init }: ApiRequestOptions = {},
): Promise<ApiSuccessResponse<TData, TMeta extends never ? never : TMeta>> {
  const isFormData = body instanceof FormData;
  const response = await fetch(`${API_URL}${path}${buildQueryString(query)}`, {
    ...init,
    ...(authenticated ? { credentials: "include" } : {}),
    headers: {
      ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<TData> | null;

  if (!response.ok || !payload || payload.status !== "success") {
    const fallback: ApiErrorResponse = {
      status: "error",
      message: "Ocurrió un error inesperado. Intenta de nuevo.",
    };
    throw new ApiRequestError(response.status, (payload as ApiErrorResponse) ?? fallback);
  }

  // El cast es seguro: `payload.status === "success"` ya lo redujo a
  // `ApiSuccessResponse<TData>`, solo falta anotar el tipo de `meta`.
  return payload as ApiSuccessResponse<TData, TMeta extends never ? never : TMeta>;
}

export { apiRequest, buildQueryString, ApiRequestError };
export type { QueryParams, QueryValue };
