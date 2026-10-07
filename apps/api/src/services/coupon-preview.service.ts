import { ErrorCode, type CartLineInput, type CouponPreview } from "@esencia-glow/shared";
import { Coupon } from "../models/coupon.model.js";
import { CouponUsage } from "../models/coupon-usage.model.js";
import { AppError } from "../utils/app-error.js";
import { resolveCartLines } from "./cart-resolution.service.js";
import { buildCouponLabel, computeCouponDiscount } from "./coupon-discount.js";
import { assertCouponApplicable, assertCouponHasRoom, normalizeCouponCode } from "./coupon-rules.js";

interface PreviewCouponInput {
  code: string;
  userId: string;
  lines: CartLineInput[];
  now?: Date;
}

/**
 * Vista previa del descuento en el checkout (Milestone 3.7). Solo LEE: corre
 * las mismas reglas que el canje (`assertCouponApplicable`) y lee los
 * contadores, pero no toma ningún lugar ni uso. El subtotal se recalcula del
 * catálogo (`resolveCartLines`), nunca viene del cliente. Quien decide al
 * final es `claimCouponUse` dentro de `createOrder`: entre esta vista previa y
 * el pago el cupón puede agotarse, y entonces el checkout lo dice.
 *
 * Aceptado: aquí todavía no se conoce el envío, así que no se aplica el piso de
 * $10 MXN del total (`MIN_PAYABLE_TOTAL_CENTS`). Un cupón que dejara el
 * subtotal casi en cero se acepta en la vista previa y `createOrder` lo
 * rechaza con COUPON_MIN_NOT_MET, que el checkout pinta en el campo del cupón.
 */
async function previewCoupon(input: PreviewCouponInput): Promise<CouponPreview> {
  const coupon = await Coupon.findOne({ code: normalizeCouponCode(input.code) });
  if (!coupon) {
    throw new AppError("Ese código no existe o ya no está disponible.", 409, undefined, ErrorCode.COUPON_INVALID);
  }

  const resolved = await resolveCartLines(input.lines);
  const subtotalCents = resolved.reduce((sum, line) => sum + line.lineTotalCents, 0);

  assertCouponApplicable(coupon, { userId: input.userId, subtotalCents, now: input.now ?? new Date() });

  const usage = await CouponUsage.findOne({ couponId: coupon._id, userId: input.userId });
  assertCouponHasRoom(coupon, usage?.uses ?? 0);

  const discount = {
    discountType: coupon.discountType,
    ...(coupon.percentOff !== undefined && coupon.percentOff !== null ? { percentOff: coupon.percentOff } : {}),
    ...(coupon.amountOffCents !== undefined && coupon.amountOffCents !== null ? { amountOffCents: coupon.amountOffCents } : {}),
  };

  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountCents: computeCouponDiscount({ ...discount, subtotalCents }),
    label: buildCouponLabel(discount),
  };
}

export { previewCoupon };
export type { PreviewCouponInput };
