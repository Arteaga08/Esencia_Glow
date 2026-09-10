/**
 * Settings singleton, diseñado por secciones: cada milestone que necesita un
 * umbral de negocio configurable le suma su propia clave (1.8 sumará
 * contenido del home) sin tocar las demás.
 */
interface InventorySettings {
  lowStockThreshold: number;
  reservationTtlMinutes: number;
  sweepBatchSize: number;
}

/**
 * Sección de negocio del checkout (Milestone 1.5). `taxRateBps` en puntos
 * base enteros (1600 = 16%) — nunca un float, para que la aritmética de
 * centavos de `order-totals.ts` sea exacta. `freeShippingThresholdCents: 0`
 * significa desactivado, explícitamente (con `>=` cualquier carrito
 * calificaría). `shippingQuoteTtlMinutes` debe superar
 * `inventory.reservationTtlMinutes` o el cliente que vuelve de pagar se topa
 * con una cotización de envío ya vencida mientras su reserva sigue viva.
 */
interface CommerceSettings {
  taxRateBps: number;
  freeShippingThresholdCents: number;
  shippingQuoteTtlMinutes: number;
}

interface AppSettings {
  inventory: InventorySettings;
  commerce: CommerceSettings;
}

export type { InventorySettings, CommerceSettings, AppSettings };
