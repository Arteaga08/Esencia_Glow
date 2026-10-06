import { ErrorCode } from "@esencia-glow/shared";
import type { Failure } from "../auth-errors";

/**
 * Qué hace el checkout ante un fallo de `POST /orders`. Decide por `code`
 * (estable), nunca por el texto del mensaje.
 *  - `requote`: la cotización venció o el carrito cambió → volver al envío.
 *  - `cart`: algo ya no se vende o se agotó → volver al carrito.
 *  - `resume`: ya hay un pedido pendiente (`orderId`) → reanudar su pago.
 *  - `unavailable`: los pagos están apagados en el servidor.
 *  - `message`: cualquier otro caso; se muestra el mensaje y se puede reintentar.
 */
type PlaceOrderAction = "requote" | "cart" | "resume" | "unavailable" | "message";

interface PlaceOrderFailure {
  action: PlaceOrderAction;
  message: string;
  orderId?: string;
  /**
   * Red caída, servidor con fallo o límite de intentos: el pedido pudo haberse
   * creado sin que lo supiéramos, así que la llave de idempotencia se conserva
   * para que el reintento haga replay. Un rechazo definitivo (4xx) la suelta.
   */
  retryable: boolean;
}

function mapPlaceOrderFailure(failure: Failure): PlaceOrderFailure {
  const { message } = failure;
  const retryable = failure.kind === "network" || failure.kind === "server" || failure.kind === "rateLimited";

  if (failure.code === ErrorCode.SHIPPING_QUOTE_INVALID || failure.code === ErrorCode.CART_CHANGED) return { action: "requote", message, retryable };
  if (failure.code === ErrorCode.ITEM_UNAVAILABLE) return { action: "cart", message, retryable };

  if (failure.code === ErrorCode.PENDING_ORDER_EXISTS) {
    const orderId = failure.fieldErrors.orderId;
    // Sin el id no hay a qué pedido reanudar: se dice el mensaje del API y ya.
    return orderId ? { action: "resume", message, orderId, retryable } : { action: "message", message, retryable };
  }

  if (failure.status === 503) return { action: "unavailable", message, retryable };
  return { action: "message", message, retryable };
}

export { mapPlaceOrderFailure };
export type { PlaceOrderAction, PlaceOrderFailure };
