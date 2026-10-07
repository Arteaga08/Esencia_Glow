/**
 * Límites del módulo de cupones (Milestone 3.7). Compartidos para que el
 * formulario del panel y el validador del API pidan exactamente lo mismo.
 */

/** Mayúsculas, dígitos y guion; sin espacios ni acentos para que se teclee sin dudas. */
const COUPON_CODE_PATTERN = /^[A-Z0-9-]+$/;
const COUPON_CODE_MIN_LENGTH = 4;
const COUPON_CODE_MAX_LENGTH = 24;
const COUPON_DESCRIPTION_MAX_LENGTH = 200;
const COUPON_MAX_PER_CUSTOMER_LIMIT = 100;

/**
 * Monto mínimo que Stripe acepta cobrar en MXN ($10.00). Un cupón que dejara
 * el total por debajo se rechaza en vez de crear un pedido imposible de pagar.
 */
const MIN_PAYABLE_TOTAL_CENTS = 1_000;

export {
  COUPON_CODE_PATTERN,
  COUPON_CODE_MIN_LENGTH,
  COUPON_CODE_MAX_LENGTH,
  COUPON_DESCRIPTION_MAX_LENGTH,
  COUPON_MAX_PER_CUSTOMER_LIMIT,
  MIN_PAYABLE_TOTAL_CENTS,
};
