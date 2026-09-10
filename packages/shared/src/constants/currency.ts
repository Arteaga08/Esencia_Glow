/**
 * Moneda única del catálogo (decisión cerrada del Milestone 1: México, sin
 * multi-moneda). No es un campo por producto — evita inconsistencias de
 * mezclar monedas en un mismo listado o carrito.
 */
const CATALOG_CURRENCY = "MXN";

type Currency = typeof CATALOG_CURRENCY;

export { CATALOG_CURRENCY };
export type { Currency };
