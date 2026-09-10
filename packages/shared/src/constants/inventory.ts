import type { InventorySettings } from "../types/settings.js";

/** Defaults del singleton de Settings cuando aún no existe el documento. */
const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  lowStockThreshold: 5,
  reservationTtlMinutes: 30,
  sweepBatchSize: 100,
};

/**
 * Tope de unidades por línea de reserva. El rate limiter no alcanza contra
 * esto: un solo request con `quantity: 100000` apartaría el catálogo entero.
 */
const MAX_LINE_QUANTITY = 99;

export { DEFAULT_INVENTORY_SETTINGS, MAX_LINE_QUANTITY };
