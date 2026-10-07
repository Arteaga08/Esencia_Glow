/**
 * Códigos estables de error de la API. El front decide por código, nunca por el
 * texto del mensaje (que es lenguaje humano y puede cambiar). Solo existen para
 * los casos en que una pantalla debe distinguir un error de otro con el mismo
 * status; un error sin código se trata según su status.
 */
enum ErrorCode {
  /** 401 al cambiar la contraseña: la actual está mal (no es una sesión vencida). */
  CURRENT_PASSWORD_INCORRECT = "CURRENT_PASSWORD_INCORRECT",
  /** 403 al ingresar con credenciales válidas pero sin haber verificado el correo. */
  EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED",
  /** 403 de `verifyOrigin`: la petición viene de un origen que no está en la lista. */
  ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED",
  /** 409 al crear un pedido: la clienta ya tiene uno pendiente de pago (`errors.orderId`). */
  PENDING_ORDER_EXISTS = "PENDING_ORDER_EXISTS",
  /** 409 al crear un pedido: la cotización de envío venció, no existe o no es suya. */
  SHIPPING_QUOTE_INVALID = "SHIPPING_QUOTE_INVALID",
  /** 409 al crear un pedido: el carrito cambió desde que se cotizó el envío. */
  CART_CHANGED = "CART_CHANGED",
  /** 409 al crear un pedido: algo del carrito ya no se vende o se quedó sin stock. */
  ITEM_UNAVAILABLE = "ITEM_UNAVAILABLE",
  /** 4xx con cupón: no existe, está inactivo, aún no vigente o es de otra clienta. */
  COUPON_INVALID = "COUPON_INVALID",
  /** 4xx con cupón: ya pasó su fecha de fin. */
  COUPON_EXPIRED = "COUPON_EXPIRED",
  /** 4xx con cupón: ya lo tomó el tope de clientas. */
  COUPON_EXHAUSTED = "COUPON_EXHAUSTED",
  /** 4xx con cupón: la clienta ya gastó sus usos. */
  COUPON_ALREADY_USED = "COUPON_ALREADY_USED",
  /** 4xx con cupón: el subtotal no alcanza el mínimo de compra, o el total quedaría imposible de cobrar. */
  COUPON_MIN_NOT_MET = "COUPON_MIN_NOT_MET",
}

export { ErrorCode };
