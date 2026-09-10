/**
 * Vocabulario del DOMINIO para el estado de pago embebido en una orden — no
 * el vocabulario del proveedor. El adapter de pagos (Milestone 1.6) traduce
 * los eventos de Stripe a estos valores; la orden y el panel nunca leen un
 * estado crudo de Stripe.
 */
enum PaymentState {
  PENDING = "pending",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export { PaymentState };
