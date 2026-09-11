/**
 * Vocabulario del DOMINIO para el estado de pago embebido en una orden — no
 * el vocabulario del proveedor. El adapter de pagos (Milestone 1.6) traduce
 * los eventos de Stripe a estos valores; la orden y el panel nunca leen un
 * estado crudo de Stripe.
 *
 * Sin `authorized`: este proyecto no tiene captura manual (todas las líneas
 * son de stock inmediato), así que el ciclo es directo
 * `pending -> captured` (o `failed`/`canceled`), más `refunded` después.
 */
enum PaymentState {
  PENDING = "pending",
  CAPTURED = "captured",
  FAILED = "failed",
  CANCELED = "canceled",
  REFUNDED = "refunded",
}

export { PaymentState };
