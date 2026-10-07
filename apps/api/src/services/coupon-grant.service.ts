import { CouponAction, CouponKind, UserRole, type AdminCoupon } from "@esencia-glow/shared";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";
import { sendCouponEmail } from "./coupon-email.service.js";
import { buildCouponLabel } from "./coupon-discount.js";
import { buildAdminCoupon } from "./coupon-dto.js";
import { insertCoupon, type CreateCouponValues } from "./coupon-admin.service.js";

/**
 * "Dar cupón" a una clienta desde Clientes (Milestone 3.7): crea un cupón
 * personal ligado a ella (un solo lugar, `maxCustomers = 1`) y se lo manda por
 * correo. El correo es best-effort como todos: si no sale, el cupón ya existe y
 * la respuesta lo dice para que el admin pueda avisarle por otro medio.
 */

interface GrantCouponResult {
  coupon: AdminCoupon;
  emailSent: boolean;
}

const MX_DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" });

async function giveCouponToCustomer(
  customerId: string,
  values: Omit<CreateCouponValues, "maxCustomers">,
  adminId: string,
): Promise<GrantCouponResult> {
  // Solo clientas: el id de un admin responde igual que uno inexistente (mismo criterio que el detalle de 2.6).
  const customer = await User.findOne({ _id: customerId, role: UserRole.CUSTOMER })
    .select("email firstName lastName")
    .lean<{ _id: Types.ObjectId; email: string; firstName: string; lastName: string }>();
  if (!customer) throw new AppError("Cliente no encontrado.", 404);

  const coupon = await insertCoupon({
    ...values,
    kind: CouponKind.PERSONAL,
    maxCustomers: 1,
    adminId,
    assignedUserId: customer._id.toString(),
  });

  await recordAudit({
    action: CouponAction.COUPON_GRANTED,
    actorId: adminId,
    targetId: coupon._id,
    metadata: { code: coupon.code, customerId: customer._id.toString() },
  });

  const { sent } = await sendCouponEmail({
    to: customer.email,
    name: customer.firstName,
    code: coupon.code,
    discountLabel: buildCouponLabel(coupon),
    ...(coupon.endsAt ? { expires: `Vigente hasta el ${MX_DATE_FORMATTER.format(coupon.endsAt)}` } : {}),
    ...(coupon.description ? { message: coupon.description } : {}),
    shopUrl: env.clientUrl,
  });

  return { coupon: buildAdminCoupon(coupon, customer), emailSent: sent };
}

export { giveCouponToCustomer };
export type { GrantCouponResult };
