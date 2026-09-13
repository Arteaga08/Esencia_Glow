/**
 * Acciones auditables del módulo de suscripciones. Vive junto a `AuthAction`,
 * `InventoryAction` y `OrderAction` porque `AuditLog.action` acepta la unión
 * de los cuatro — un solo trail append-only para todo el backend (ver
 * audit.service.ts).
 */
enum SubscriptionAction {
  PLAN_CREATED = "subscription_plan_created",
  PLAN_UPDATED = "subscription_plan_updated",
  PLAN_DEACTIVATED = "subscription_plan_deactivated",
  EDITION_CREATED = "subscription_edition_created",
  EDITION_UPDATED = "subscription_edition_updated",
  EDITION_PUBLISHED = "subscription_edition_published",
  EDITION_UNPUBLISHED = "subscription_edition_unpublished",
  EDITION_DELETED = "subscription_edition_deleted",
  /** Declaradas para el ciclo de vida de la cuenta de la suscriptora, pero
   * SIN emisor todavía: 1.7.1 no expone alta/pausa/cancelación por HTTP (no
   * hay Stripe Billing conectado) — mismo criterio que `RESERVATION_CREATED`
   * en `InventoryAction`. 1.7.2/1.7.3 las conectan desde el webhook y los
   * endpoints de la suscriptora, que sí tienen ese contexto. */
  SUBSCRIPTION_STARTED = "subscription_started",
  SUBSCRIPTION_CANCELED = "subscription_canceled",
  SUBSCRIPTION_PAUSED = "subscription_paused",
  SUBSCRIPTION_RESUMED = "subscription_resumed",
  SUBSCRIPTION_PLAN_CHANGED = "subscription_plan_changed",
  SUBSCRIPTION_PAST_DUE = "subscription_past_due",
  SUBSCRIPTION_SEAT_EXHAUSTED = "subscription_seat_exhausted",
  SHIPMENT_EDITION_MISSING = "subscription_shipment_edition_missing",
}

export { SubscriptionAction };
