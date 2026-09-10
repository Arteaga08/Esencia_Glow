import type { CommerceSettings } from "../types/settings.js";

/**
 * Defaults del singleton de Settings, sección `commerce` (Milestone 1.5:
 * IVA y envío gratis — home llega en 1.8). `taxRateBps` en puntos base
 * enteros (1600 = 16%), nunca un float, para que la aritmética de centavos
 * en `order-totals.ts` no arrastre error de punto flotante.
 */
const DEFAULT_COMMERCE_SETTINGS: CommerceSettings = {
  taxRateBps: 1600,
  freeShippingThresholdCents: 0,
  shippingQuoteTtlMinutes: 60,
};

/** Un carrito de cientos de líneas convertiría el checkout en una
 * transacción de cientos de escrituras a `Inventory`. */
const MAX_ORDER_LINES = 50;

/** Aplica sobre la cantidad de PAQUETES, no sobre las unidades ya expandidas
 * a sus componentes — `MAX_LINE_QUANTITY` (inventory.ts) cubre esas. */
const MAX_BUNDLE_QUANTITY = 20;

/** Un array de bitácora sin techo es un DoS del documento contra sí mismo. */
const MAX_STATUS_HISTORY = 50;

/** Notas internas de una orden: mismo criterio que la bitácora de estatus. */
const MAX_INTERNAL_NOTES = 50;

/** Gramos de empaque (caja, relleno, etiqueta) sumados al peso real de las
 * variantes — evita subcotizar sistemáticamente el envío. */
const PACKAGING_TARE_GRAMS = 150;

/** Factor de relleno/huecos al estimar el volumen de la caja desde el
 * volumen bruto de los artículos. */
const PACKING_EFFICIENCY = 1.25;

/** Caja mínima que Skydropx (y cualquier paquetería real) factura, en cm. */
const MIN_BOX_CM = { length: 15, width: 15, height: 5 };

/** Un solo paquete en 1.5. El split multi-paquete por este techo es 1.9. */
const MAX_PARCEL_WEIGHT_GRAMS = 20_000;

/** Cuántas cotizaciones de envío fijas devuelve el stub (1.9 las reemplaza
 * por tarifas reales de Skydropx). */
const STUB_SHIPPING_RATES_COUNT = 3;

export {
  DEFAULT_COMMERCE_SETTINGS,
  MAX_ORDER_LINES,
  MAX_BUNDLE_QUANTITY,
  MAX_STATUS_HISTORY,
  MAX_INTERNAL_NOTES,
  PACKAGING_TARE_GRAMS,
  PACKING_EFFICIENCY,
  MIN_BOX_CM,
  MAX_PARCEL_WEIGHT_GRAMS,
  STUB_SHIPPING_RATES_COUNT,
};
