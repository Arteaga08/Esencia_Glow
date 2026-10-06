import { ErrorCode } from "@esencia-glow/shared";
import type { Failure } from "../auth-errors";

/** Lo que el paso de envío pinta cuando la cotización no sale bien. */
type QuoteFailureState =
  /** La paquetería no tiene opciones para esa dirección (422). */
  | { status: "empty"; message: string }
  /** Algo del carrito ya no se vende. */
  | { status: "unavailable"; message: string }
  /** El API objetó campos de la dirección: van pegados a su campo. */
  | { status: "invalid"; message: string; errors: Record<string, string> }
  /** Sesión vencida: hay que refrescarla (el checkout nunca manda a otra página). */
  | { status: "unauthorized" }
  /** Paquetería lenta o caída, o sin red: se puede reintentar. */
  | { status: "error"; message: string };

function classifyQuoteFailure(failure: Failure): QuoteFailureState {
  if (failure.kind === "unauthorized") return { status: "unauthorized" };
  if (failure.status === 422) return { status: "empty", message: failure.message };
  if (failure.code === ErrorCode.ITEM_UNAVAILABLE) return { status: "unavailable", message: failure.message };
  if (failure.kind === "invalid" && Object.keys(failure.fieldErrors).length > 0) {
    return { status: "invalid", message: failure.message, errors: failure.fieldErrors };
  }
  return { status: "error", message: failure.message };
}

export { classifyQuoteFailure };
export type { QuoteFailureState };
