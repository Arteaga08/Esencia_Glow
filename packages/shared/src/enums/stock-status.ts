/**
 * Estado de disponibilidad de una fila de inventario, resuelto en el
 * servidor contra el umbral efectivo (override por SKU o el global de
 * Settings — ver ECOMMERCE_ARCHITECTURE_GUIDELINES.md §Inventario).
 * `UNTRACKED` es el estado de una variante `in_stock` que todavía no tiene
 * fila de `Inventory` — "sin registro" no es lo mismo que "agotado".
 */
enum StockStatus {
  OUT = "out",
  LOW = "low",
  OK = "ok",
  UNTRACKED = "untracked",
}

export { StockStatus };
