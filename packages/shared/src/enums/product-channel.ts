/**
 * Canal de venta de un producto (Milestone 1.7.1). `STORE` es el catálogo
 * normal; `SUBSCRIPTION` lo reserva la caja curada — queda fuera del
 * catálogo público y no se puede comprar suelto (ver
 * build-product-filter.ts y cart-resolution.service.ts en apps/api).
 * `BOTH` (Milestone 2.7c) se vende en la tienda Y puede ir en la caja; comparte
 * variantes e inventario con ambos canales.
 */
enum ProductChannel {
  STORE = "store",
  SUBSCRIPTION = "subscription",
  BOTH = "both",
}

export { ProductChannel };
