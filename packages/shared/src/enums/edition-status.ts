/**
 * Estado de publicación de una `SubscriptionEdition` (Milestone 1.7.1). Sin
 * `ARCHIVED`: con un único documento por plan+ciclo, archivar no libera
 * nada — corregir una edición es editar ese mismo documento (ver
 * subscription-edition.model.ts).
 */
enum EditionStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
}

export { EditionStatus };
