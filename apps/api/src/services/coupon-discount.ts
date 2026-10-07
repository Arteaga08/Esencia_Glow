import { CouponDiscountType } from "@esencia-glow/shared";

/**
 * Cálculo puro del descuento de un cupón — cero I/O. El descuento se aplica
 * al subtotal de artículos (productos y kits por igual) y nunca al envío.
 *
 * Todo en centavos enteros: el porcentaje se redondea al centavo y ambos
 * tipos quedan topados al subtotal, así un cupón jamás deja un total
 * negativo ni descuenta más de lo que se compra.
 */
interface ComputeCouponDiscountInput {
  discountType: CouponDiscountType;
  /** Requerido si `discountType === "percent"` (1 a 100). */
  percentOff?: number;
  /** Requerido si `discountType === "fixed"`. */
  amountOffCents?: number;
  subtotalCents: number;
}

function computeCouponDiscount(input: ComputeCouponDiscountInput): number {
  const raw =
    input.discountType === CouponDiscountType.PERCENT
      ? Math.round(((input.percentOff ?? 0) * input.subtotalCents) / 100)
      : (input.amountOffCents ?? 0);
  return Math.max(0, Math.min(raw, input.subtotalCents));
}

const PESOS_FORMATTER = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/** Texto listo para mostrar ("15% de descuento", "$100.00 de descuento"): lo usan el checkout y el correo del cupón. */
function buildCouponLabel(coupon: Pick<ComputeCouponDiscountInput, "discountType" | "percentOff" | "amountOffCents">): string {
  return coupon.discountType === CouponDiscountType.PERCENT
    ? `${coupon.percentOff ?? 0}% de descuento`
    : `${PESOS_FORMATTER.format((coupon.amountOffCents ?? 0) / 100)} de descuento`;
}

export { computeCouponDiscount, buildCouponLabel };
export type { ComputeCouponDiscountInput };
