/**
 * Envoltura única de toda respuesta de la API. Los controllers nunca arman el JSON
 * a mano: pasan por `sendResponse`, que produce exactamente esta forma.
 */

type ApiStatus = "success" | "fail" | "error";

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface ApiSuccessResponse<TData = unknown, TMeta = PaginationMeta> {
  status: "success";
  message: string;
  data: TData;
  meta?: TMeta;
}

interface ApiErrorResponse {
  status: "fail" | "error";
  message: string;
  /** Errores por campo. Presente solo cuando la validación de entrada falla. */
  errors?: Record<string, string>;
  /** Stack trace. El servidor lo incluye únicamente fuera de producción. */
  stack?: string;
}

type ApiResponse<TData = unknown, TMeta = PaginationMeta> =
  | ApiSuccessResponse<TData, TMeta>
  | ApiErrorResponse;

export type {
  ApiStatus,
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginationMeta,
};
