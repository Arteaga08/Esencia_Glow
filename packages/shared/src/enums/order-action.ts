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
}

export { OrderAction };
