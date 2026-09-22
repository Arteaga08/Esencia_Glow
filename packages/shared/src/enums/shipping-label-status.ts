/**
 * Ciclo de vida de la guía de envío de una orden (Milestone 1.9). Una guía se
 * paga con créditos prepagados del proveedor, así que la máquina existe para
 * que JAMÁS se compre dos veces:
 *
 * - `pending`: en cola. Se escribe en la misma transacción que marca la orden
 *   como pagada — nunca antes del pago.
 * - `requested`: un proceso reclamó la compra (con lease); la llamada al
 *   proveedor está en vuelo.
 * - `processing`: el proveedor la aceptó y ya hay `providerShipmentId` (ya se
 *   cobró) pero el PDF/tracking aún no están listos. Desde aquí solo se
 *   CONSULTA, jamás se recompra.
 * - `ready`: guía y número de rastreo disponibles.
 * - `failed`: rechazo explícito del proveedor, se reintenta con backoff.
 * - `needs_review`: no se sabe si el proveedor cobró (timeout a media compra,
 *   proceso muerto) o se agotaron los intentos. Nunca se recompra sola: un
 *   admin confirma en el panel del proveedor y reintenta a mano.
 */
enum ShippingLabelStatus {
  PENDING = "pending",
  REQUESTED = "requested",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed",
  NEEDS_REVIEW = "needs_review",
}

export { ShippingLabelStatus };
