/**
 * Acciones auditables del módulo de órdenes. Vive junto a `AuthAction` e
 * `InventoryAction` porque `AuditLog.action` acepta la unión de los tres —
 * un solo trail append-only para todo el backend (ver audit.service.ts).
 */
enum OrderAction {
  ORDER_CREATED = "order_created",
  ORDER_PAID = "order_paid",
  ORDER_CANCELLED = "order_cancelled",
  ORDER_EXPIRED = "order_expired",
  ORDER_STATUS_CHANGED = "order_status_changed",
  ORDER_SHIPMENT_UPDATED = "order_shipment_updated",
  ORDER_SHIPPING_ADDRESS_UPDATED = "order_shipping_address_updated",
  ORDER_PRIORITY_UPDATED = "order_priority_updated",
  ORDER_NOTE_ADDED = "order_note_added",
  ORDER_STOCK_INCIDENT = "order_stock_incident",
  SHIPPING_QUOTED = "shipping_quoted",
  // --- Milestone 1.6: pagos con Stripe ---
  ORDER_PAYMENT_FAILED = "order_payment_failed",
  ORDER_PAYMENT_ANOMALY = "order_payment_anomaly",
  ORDER_RECONCILED = "order_reconciled",
  ORDER_REFUND_REQUESTED = "order_refund_requested",
  ORDER_REFUNDED = "order_refunded",
  ORDER_REFUND_FAILED = "order_refund_failed",
  ORDER_DISPUTED = "order_disputed",
  ORDER_DISPUTE_CLOSED = "order_dispute_closed",
}

export { OrderAction };
