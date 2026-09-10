/**
 * Ciclo de vida de un producto. `DRAFT` no es visible en el catálogo público
 * (permite armar el producto antes de publicarlo); `ARCHIVED` es el efecto de
 * "eliminar" un producto — preserva el historial para las órdenes que ya lo
 * referencian (nunca se hace hard delete de un producto).
 */
enum ProductStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export { ProductStatus };
