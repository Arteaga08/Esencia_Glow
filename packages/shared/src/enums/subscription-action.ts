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
  /** Conectadas en 1.7.2a: alta sobre Stripe Billing, webhook de renovación,
   * ventana de inscripciones y generación de la caja del ciclo. */
  SUBSCRIPTION_RENEWED = "subscription_renewed",
  SUBSCRIPTION_PROVIDER_MISMATCH = "subscription_provider_mismatch",
  SUBSCRIPTION_DUPLICATE_CYCLE_INVOICE = "subscription_duplicate_cycle_invoice",
  SUBSCRIPTION_ENROLLMENT_OPENED = "subscription_enrollment_opened",
  SUBSCRIPTION_ENROLLMENT_CLOSED = "subscription_enrollment_closed",
  SHIPMENT_CREATED = "subscription_shipment_created",
  SHIPMENT_INVENTORY_SHORTAGE = "subscription_shipment_inventory_shortage",
  /** Conectada en la Fase 5 de 1.7.2a: el barrendero
   * `jobs/expire-incomplete-subscriptions.ts` libera el cupo de una cuenta
   * `INCOMPLETE` cuyo 3DS/checkout nunca se completó. */
  SUBSCRIPTION_INCOMPLETE_EXPIRED = "subscription_incomplete_expired",
  /** Conectada en 1.7.2b: el panel mueve el envío del ciclo por su máquina de
   * estados. UNA sola acción con `metadata.from/to`, nunca una por estado —
   * mismo criterio que las transiciones de pedido (y el hallazgo de code
   * review de 1.6.2 fue justamente una transición que perdía ese metadata). */
  SHIPMENT_STATUS_CHANGED = "subscription_shipment_status_changed",
  /** Conectada en 1.7.2b: el job preventivo avisa que se acerca el cobro
   * anclado y el ciclo todavía no tiene edición publicada — el aviso que
   * evita que la caja nazca con `editionIncident` y la clienta ya cobrada. */
  SHIPMENT_EDITION_MISSING_UPCOMING = "subscription_shipment_edition_missing_upcoming",
}

export { SubscriptionAction };
