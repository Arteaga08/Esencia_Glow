/**
 * Acciones auditables del módulo de inventario. Vive junto a `AuthAction`
 * porque `AuditLog.action` acepta la unión de ambos enums — un solo trail
 * append-only para todo el backend.
 */
enum InventoryAction {
  STOCK_ADJUSTED = "stock_adjusted",
  /** Declaradas para el ciclo de vida de reserva/commit/expiración, pero SIN
   * emisor todavía: 1.4 no expone `reserve`/`commit` por HTTP (no hay
   * carrito ni webhook de pago que las dispare) y el cron de expiración
   * corre sin un actor humano al que atribuirle la acción. Emitirlas ahora
   * sería auditoría sin actor real. 1.5 las conecta desde el checkout y el
   * webhook de Stripe, que sí tienen ese contexto. */
  RESERVATION_CREATED = "reservation_created",
  RESERVATION_COMMITTED = "reservation_committed",
  RESERVATION_EXPIRED = "reservation_expired",
  RESERVATION_RELEASED = "reservation_released",
  COMMIT_ON_RELEASED = "commit_on_released",
  /** Un release encontró `Inventory.reserved` ya por debajo de lo que esta
   * reserva esperaba devolver — señal de una inconsistencia previa, no algo
   * que este release causó. Ver stock-reservation.service.ts. */
  RELEASE_INVENTORY_MISMATCH = "release_inventory_mismatch",
  SETTINGS_UPDATED = "settings_updated",
  /** Reembolso total sobre una orden `paid`/`processing` (nunca enviada):
   * las unidades comprometidas vuelven a `onHand`. Ver
   * reservation-restock.service.ts (Milestone 1.6). */
  RESERVATION_RESTOCKED = "reservation_restocked",
}

export { InventoryAction };
