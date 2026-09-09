/**
 * Ciclo de vida único y explícito de una orden. Las transiciones válidas se
 * verifican en el servidor (ver services/orders) — este enum es el contrato,
 * no la máquina de estados.
 */
enum OrderStatus {
  PENDING = "pending",
  PAID = "paid",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export { OrderStatus };
