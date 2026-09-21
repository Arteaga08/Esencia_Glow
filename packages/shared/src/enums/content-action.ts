/**
 * Acciones auditables del contenido editable del sitio (Milestone 1.8). Se
 * suma a la unión de `AuditLog.action` junto a Auth/Inventory/Order/
 * SubscriptionAction — un solo trail append-only para todo el backend.
 *
 * Una sola acción para todas las secciones del home: la sección concreta
 * viaja en `metadata.section` (BACKEND_ARCHITECTURE_GUIDELINES.md §"Documento
 * singleton editable por secciones" — cada entrada identifica QUÉ sección
 * cambió, no solo "el documento cambió").
 */
enum ContentAction {
  HOME_SECTION_UPDATED = "home_section_updated",
}

export { ContentAction };
