/**
 * Estado del envío de un ciclo de suscripción (Milestone 1.7). Solo el enum
 * en 1.7.1 — la máquina de transiciones la escribe 1.7.2 junto con el panel
 * que la consume (ver subscription-shipment.model.ts).
 */
enum SubscriptionShipmentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
}

export { SubscriptionShipmentStatus };
