import type { Types } from "mongoose";
import type { AdminCoupon, AdminCouponAssignee } from "@esencia-glow/shared";
import type { CouponAttrs } from "../models/coupon.model.js";

/** Cupón tal como lo devuelve `.lean()` (con `_id` y fechas de timestamps). */
interface LeanCoupon extends CouponAttrs {
  _id: Types.ObjectId;
  createdAt: Date;
}

interface LeanCouponAssignee {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
}

function buildCouponAssignee(user: LeanCouponAssignee): AdminCouponAssignee {
  return { id: user._id.toString(), firstName: user.firstName, lastName: user.lastName, email: user.email };
}

function buildAdminCoupon(coupon: LeanCoupon, assignee?: LeanCouponAssignee): AdminCoupon {
  return {
    id: coupon._id.toString(),
    code: coupon.code,
    kind: coupon.kind,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    ...(coupon.percentOff != null ? { percentOff: coupon.percentOff } : {}),
    ...(coupon.amountOffCents != null ? { amountOffCents: coupon.amountOffCents } : {}),
    ...(coupon.minSubtotalCents != null ? { minSubtotalCents: coupon.minSubtotalCents } : {}),
    ...(coupon.startsAt ? { startsAt: coupon.startsAt.toISOString() } : {}),
    ...(coupon.endsAt ? { endsAt: coupon.endsAt.toISOString() } : {}),
    isActive: coupon.isActive,
    ...(coupon.maxCustomers != null ? { maxCustomers: coupon.maxCustomers } : {}),
    perCustomerLimit: coupon.perCustomerLimit,
    customersCount: coupon.customersCount,
    ...(assignee ? { assignedUser: buildCouponAssignee(assignee) } : {}),
    createdAt: coupon.createdAt.toISOString(),
  };
}

export { buildAdminCoupon };
export type { LeanCoupon, LeanCouponAssignee };
