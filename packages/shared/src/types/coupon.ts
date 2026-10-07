import type { CouponDiscountType } from "../enums/coupon-discount-type.js";
import type { CouponKind } from "../enums/coupon-kind.js";
import type { CartLineInput } from "./shipping.js";

/** Clienta a la que está ligado un cupón personal, tal como la ve el panel. */
interface AdminCouponAssignee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Cupón en el panel admin (Milestone 3.7). */
interface AdminCoupon {
  id: string;
  code: string;
  kind: CouponKind;
  description: string;
  discountType: CouponDiscountType;
  /** Solo si `discountType === "percent"` (1 a 100). */
  percentOff?: number;
  /** Solo si `discountType === "fixed"`. */
  amountOffCents?: number;
  minSubtotalCents?: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  /** Tope de clientas distintas; ausente = sin tope. */
  maxCustomers?: number;
  perCustomerLimit: number;
  /** Clientas distintas que ya lo tienen tomado (contador atómico). */
  customersCount: number;
  assignedUser?: AdminCouponAssignee;
  createdAt: string;
}

/**
 * Cuerpo de `POST /admin/coupons` (cupón público). Fechas en ISO 8601; el
 * panel manda inicio a las 00:00 y fin a las 23:59 de la hora de México.
 */
interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  percentOff?: number;
  amountOffCents?: number;
  minSubtotalCents?: number;
  startsAt?: string;
  endsAt?: string;
  /** Tope de clientas distintas; omitido = sin tope. */
  maxCustomers?: number;
  perCustomerLimit?: number;
}

/** Cuerpo de `POST /admin/customers/:id/coupons` (cupón personal): sin tope de personas, siempre es una sola clienta. */
type GiveCouponInput = Omit<CreateCouponInput, "maxCustomers">;

/** Cuerpo de `POST /coupons/validate`: el servidor recalcula todo, nunca recibe un monto. */
interface ValidateCouponInput {
  code: string;
  lines: CartLineInput[];
}

/** Vista previa del descuento en el checkout; quien decide es el canje al crear el pedido. */
interface CouponPreview {
  code: string;
  discountType: CouponDiscountType;
  discountCents: number;
  /** Texto listo para mostrar, p. ej. "15% de descuento". */
  label: string;
}

/** Respuesta de `POST /admin/customers/:id/coupons`. */
interface GiveCouponResult {
  coupon: AdminCoupon;
  /** `false` si el correo no pudo salir; el cupón existe de todos modos. */
  emailSent: boolean;
}

export type {
  AdminCouponAssignee,
  AdminCoupon,
  CreateCouponInput,
  GiveCouponInput,
  ValidateCouponInput,
  CouponPreview,
  GiveCouponResult,
};
