import { CouponDiscountType, CouponKind, type AdminCoupon } from "@esencia-glow/shared";
import type { BadgeColorValue } from "@/components/ui/badge";
import { formatShortDate } from "./format-date";
import { formatMoneyMXN } from "./format-money";

/** Textos del listado de cupones del panel: puros, para probarlos sin pantalla. */

/** "15 %" o "$100.00", con "· desde $800.00" si exige compra mínima. */
function describeCouponDiscount(coupon: AdminCoupon): string {
  const base =
    coupon.discountType === CouponDiscountType.PERCENT ? `${coupon.percentOff ?? 0} %` : formatMoneyMXN(coupon.amountOffCents ?? 0);
  return coupon.minSubtotalCents ? `${base} · desde ${formatMoneyMXN(coupon.minSubtotalCents)}` : base;
}

function describeCouponUsage(coupon: AdminCoupon): string {
  if (coupon.kind === CouponKind.PERSONAL) return coupon.customersCount > 0 ? "Canjeado" : "Sin usar";
  if (coupon.maxCustomers != null) return `${coupon.customersCount} de ${coupon.maxCustomers} personas`;
  return `${coupon.customersCount} ${coupon.customersCount === 1 ? "persona" : "personas"}`;
}

function describeCouponValidity(coupon: AdminCoupon): string {
  if (coupon.startsAt && coupon.endsAt) return `${formatShortDate(coupon.startsAt)} – ${formatShortDate(coupon.endsAt)}`;
  if (coupon.startsAt) return `Desde ${formatShortDate(coupon.startsAt)}`;
  if (coupon.endsAt) return `Hasta ${formatShortDate(coupon.endsAt)}`;
  return "Sin vencimiento";
}

interface CouponStatus {
  label: string;
  color: BadgeColorValue;
}

/** Estado real del cupón hoy (no solo el interruptor): desactivado manda sobre vencido, programado y agotado. */
function couponStatus(coupon: AdminCoupon, now: Date = new Date()): CouponStatus {
  if (!coupon.isActive) return { label: "Inactivo", color: "neutral" };
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now.getTime()) return { label: "Vencido", color: "neutral" };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) return { label: "Programado", color: "info" };
  if (coupon.maxCustomers != null && coupon.customersCount >= coupon.maxCustomers) return { label: "Agotado", color: "warning" };
  return { label: "Activo", color: "success" };
}

export { describeCouponDiscount, describeCouponUsage, describeCouponValidity, couponStatus };
export type { CouponStatus };
