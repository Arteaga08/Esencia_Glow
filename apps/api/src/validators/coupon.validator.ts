import Joi from "joi";
import { COUPON_CODE_MAX_LENGTH, MAX_ORDER_LINES } from "@esencia-glow/shared";
import { cartLineSchema } from "./shipping.validator.js";

/**
 * Body de `POST /coupons/validate`. Solo el código y las líneas del carrito:
 * con `stripUnknown` en el middleware `validate`, cualquier monto que mande el
 * cliente se descarta, y el descuento se recalcula desde la base.
 */
const validateCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().min(1).max(COUPON_CODE_MAX_LENGTH).required(),
  lines: Joi.array().items(cartLineSchema).min(1).max(MAX_ORDER_LINES).required(),
});

export { validateCouponSchema };
