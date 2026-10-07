import { Types, type FilterQuery } from "mongoose";
import {
  CouponAction,
  CouponKind,
  type AdminCoupon,
  type CouponDiscountType,
  type ListQuery,
  type PaginationMeta,
} from "@esencia-glow/shared";
import { Coupon, type CouponAttrs } from "../models/coupon.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { isDuplicateKeyError } from "../utils/duplicate-key-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { recordAudit } from "./audit.service.js";
import { buildAdminCoupon, type LeanCoupon, type LeanCouponAssignee } from "./coupon-dto.js";

/**
 * Administración de cupones desde el panel (Milestone 3.7): listar, crear un
 * cupón público y activar/desactivar. "Dar cupón" a una clienta vive en
 * `coupon-grant.service.ts`. Un cupón creado nunca cambia de valor: lo que
 * una clienta vio al recibirlo es lo que canjea.
 */

const ADMIN_COUPON_SORT_FIELDS = ["createdAt", "code"] as const;
const DUPLICATE_CODE_MESSAGE = "Ya existe un cupón con ese código.";

interface CreateCouponValues {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  percentOff?: number;
  amountOffCents?: number;
  minSubtotalCents?: number;
  startsAt?: Date;
  endsAt?: Date;
  maxCustomers?: number;
  perCustomerLimit: number;
}

interface InsertCouponInput extends CreateCouponValues {
  kind: CouponKind;
  adminId: string;
  assignedUserId?: string;
}

/** Inserta el cupón; el índice único de `code` convierte un duplicado en un 409 pegado al campo. */
async function insertCoupon(input: InsertCouponInput): Promise<LeanCoupon> {
  const { adminId, assignedUserId, ...values } = input;
  try {
    const created = await Coupon.create({
      ...values,
      isActive: true,
      customersCount: 0,
      createdBy: new Types.ObjectId(adminId),
      ...(assignedUserId ? { assignedUserId: new Types.ObjectId(assignedUserId) } : {}),
    });
    return created.toObject() as unknown as LeanCoupon;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(DUPLICATE_CODE_MESSAGE, 409, { code: DUPLICATE_CODE_MESSAGE });
    }
    throw error;
  }
}

async function createPublicCoupon(values: CreateCouponValues, adminId: string): Promise<AdminCoupon> {
  const coupon = await insertCoupon({ ...values, kind: CouponKind.PUBLIC, adminId });
  await recordAudit({
    action: CouponAction.COUPON_CREATED,
    actorId: adminId,
    targetId: coupon._id,
    metadata: { code: coupon.code, kind: coupon.kind },
  });
  return buildAdminCoupon(coupon);
}

interface ListCouponsInput extends ListQuery {
  kind?: CouponKind;
  status?: "active" | "inactive";
}

async function listCoupons(input: ListCouponsInput): Promise<{ rows: AdminCoupon[]; meta: PaginationMeta }> {
  const filter: FilterQuery<CouponAttrs> = {};
  if (input.kind) filter.kind = input.kind;
  if (input.status) filter.isActive = input.status === "active";
  if (input.search) filter.code = new RegExp(escapeRegex(input.search), "i");

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort(resolveSort(input.sort, ADMIN_COUPON_SORT_FIELDS, "createdAt"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanCoupon[]>(),
    Coupon.countDocuments(filter),
  ]);

  // Una sola lectura de las dueñas de los cupones personales de la página, nunca una por fila.
  const assigneeIds = coupons.flatMap((coupon) => (coupon.assignedUserId ? [coupon.assignedUserId] : []));
  const assignees = assigneeIds.length
    ? await User.find({ _id: { $in: assigneeIds } })
        .select("firstName lastName email")
        .lean<LeanCouponAssignee[]>()
    : [];
  const assigneeById = new Map(assignees.map((user) => [user._id.toString(), user]));

  const rows = coupons.map((coupon) =>
    buildAdminCoupon(coupon, coupon.assignedUserId ? assigneeById.get(coupon.assignedUserId.toString()) : undefined),
  );
  return { rows, meta: buildMeta(total, input) };
}

async function setCouponActive(couponId: string, isActive: boolean, adminId: string): Promise<AdminCoupon> {
  const coupon = await Coupon.findOneAndUpdate({ _id: couponId }, { $set: { isActive } }, { new: true }).lean<LeanCoupon>();
  if (!coupon) throw new AppError("Cupón no encontrado.", 404);

  await recordAudit({
    action: isActive ? CouponAction.COUPON_ACTIVATED : CouponAction.COUPON_DEACTIVATED,
    actorId: adminId,
    targetId: coupon._id,
    metadata: { code: coupon.code },
  });

  const assignee = coupon.assignedUserId
    ? await User.findById(coupon.assignedUserId).select("firstName lastName email").lean<LeanCouponAssignee>()
    : null;
  return buildAdminCoupon(coupon, assignee ?? undefined);
}

export { createPublicCoupon, insertCoupon, listCoupons, setCouponActive };
export type { CreateCouponValues, InsertCouponInput, ListCouponsInput };
