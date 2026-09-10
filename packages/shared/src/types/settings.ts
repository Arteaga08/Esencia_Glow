/**
 * Settings singleton, diseñado por secciones: cada milestone que necesita un
 * umbral de negocio configurable le suma su propia clave (1.8 sumará IVA,
 * envío gratis, contenido del home) sin tocar las demás.
 */
interface InventorySettings {
  lowStockThreshold: number;
  reservationTtlMinutes: number;
  sweepBatchSize: number;
}

interface AppSettings {
  inventory: InventorySettings;
}

export type { InventorySettings, AppSettings };
