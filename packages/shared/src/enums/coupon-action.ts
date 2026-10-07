/**
 * Acciones auditables del módulo de cupones (Milestone 3.7). Vive junto a
 * `OrderAction` y `SubscriptionAction` porque `AuditLog.action` acepta la
 * unión de todas — un solo trail append-only para todo el backend.
 */
enum CouponAction {
  COUPON_CREATED = "coupon_created",
  COUPON_GRANTED = "coupon_granted",
  COUPON_DEACTIVATED = "coupon_deactivated",
  COUPON_ACTIVATED = "coupon_activated",
  COUPON_REDEEMED = "coupon_redeemed",
  COUPON_RELEASED = "coupon_released",
}

export { CouponAction };
