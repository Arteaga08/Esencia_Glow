/**
 * Ciclo de vida de un `Bundle` (paquete). Mismos valores que `ProductStatus`
 * por simetría, pero es su propio enum: un bundle es una entidad distinta de
 * un producto (precio manual, sin inventario propio — ver
 * BACKEND_ARCHITECTURE_GUIDELINES.md / decisiones de Milestone 1.4.1) y no
 * debe leerse ni auditarse como si fuera un `Product`.
 */
enum BundleStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export { BundleStatus };
