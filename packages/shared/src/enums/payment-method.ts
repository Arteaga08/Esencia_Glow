/**
 * Método de pago elegido por la clienta al hacer checkout — determina el
 * TTL de la reserva de stock y el flujo de cierre de la orden (ver
 * order-payment-intent.service.ts y order-closing.service.ts).
 */
enum PaymentMethod {
  CARD = "card",
  OXXO = "oxxo",
}

export { PaymentMethod };
