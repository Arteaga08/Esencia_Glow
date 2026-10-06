/**
 * Topes y catálogos cerrados de "Mi Cuenta" (Milestone 3.5b). Viven en shared
 * para que la validación del API y los selects de la tienda no se desfasen.
 */

/** Libreta de direcciones: subdocumento embebido acotado, no colección aparte. */
const MAX_ADDRESSES = 5;
/** Guardados: tope por usuaria; se hidrata contra el catálogo vivo en cada lectura. */
const MAX_WISHLIST_ITEMS = 50;

interface FiscalOption {
  value: string;
  label: string;
}

/** Uso del CFDI (catálogo SAT, subconjunto común en venta al público). */
const CFDI_USES: readonly FiscalOption[] = [
  { value: "G01", label: "G01 Adquisición de mercancías" },
  { value: "G03", label: "G03 Gastos en general" },
  { value: "S01", label: "S01 Sin efectos fiscales" },
];

/** Régimen fiscal (catálogo SAT, subconjunto de personas físicas). */
const FISCAL_REGIMES: readonly FiscalOption[] = [
  { value: "605", label: "605 Sueldos y salarios" },
  { value: "612", label: "612 Personas físicas con actividades empresariales" },
  { value: "626", label: "626 Régimen simplificado de confianza" },
];

/** RFC de persona física (13) o moral (12), en mayúsculas. */
const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export { MAX_ADDRESSES, MAX_WISHLIST_ITEMS, CFDI_USES, FISCAL_REGIMES, RFC_PATTERN };
export type { FiscalOption };
