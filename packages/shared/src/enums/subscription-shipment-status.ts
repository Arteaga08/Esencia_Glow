/**
 * Estado del envío de un ciclo de suscripción (Milestone 1.7). El enum nace
 * en 1.7.1; la máquina de transiciones que lo gobierna es
 * `subscription-shipment-state.ts` (1.7.2b), junto con el panel que la
 * consume.
 *
 * `CANCELED` (1.7.2b) es el único estado que NO avanza el flujo: la caja no
 * se va a enviar (se dañó, la suscriptora canceló a mitad del ciclo) y su
 * reserva de inventario vuelve a estar disponible. Cancelar solo es posible
 * ANTES de enviar — una vez que la caja salió, el stock ya se descontó y la
 * vuelta atrás es física, no de software.
 */
enum SubscriptionShipmentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELED = "canceled",
}

export { SubscriptionShipmentStatus };
