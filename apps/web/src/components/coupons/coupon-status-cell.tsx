"use client";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { couponStatus } from "@/lib/coupon-labels";
import type { AdminCoupon } from "@esencia-glow/shared";

interface CouponStatusCellProps {
  coupon: AdminCoupon;
  busy: boolean;
  onToggle: (coupon: AdminCoupon, isActive: boolean) => void;
}

/** Estado real del cupón (activo, vencido, agotado…) y el interruptor que lo activa o desactiva. */
function CouponStatusCell({ coupon, busy, onToggle }: CouponStatusCellProps) {
  const status = couponStatus(coupon);
  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={coupon.isActive}
        onChange={(checked) => onToggle(coupon, checked)}
        label={coupon.isActive ? `Desactivar el cupón ${coupon.code}` : `Activar el cupón ${coupon.code}`}
        disabled={busy}
        className="cursor-pointer"
      />
      <Badge color={status.color}>{status.label}</Badge>
    </div>
  );
}

export { CouponStatusCell };
