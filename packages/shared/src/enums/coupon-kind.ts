/**
 * Clase de cupón (Milestone 3.7). `public` se publica fuera de la tienda y lo
 * puede canjear cualquier clienta con cuenta, hasta su tope de personas;
 * `personal` se da a una clienta desde Clientes y solo ella lo canjea.
 */
enum CouponKind {
  PUBLIC = "public",
  PERSONAL = "personal",
}

export { CouponKind };
