import { CouponKind, ErrorCode } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";

/**
 * Reglas de un cupón que no dependen de contadores (Milestone 3.7): activo,
 * vigencia, dueña y mínimo de compra. Las usan la vista previa del checkout
 * y el canje real, así que no pueden divergir. Los topes de personas y de
 * usos por clienta SÍ dependen de contadores y se deciden en el update
 * atómico de `coupon-redemption.service.ts`.
 *
 * Inexistente, desactivado, aún no vigente y de otra clienta comparten
 * `COUPON_INVALID` y el mismo mensaje: quien adivina códigos no debe poder
 * distinguir cuáles existen.
 */
interface CouponRuleInput {
  kind: CouponKind;
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  assignedUserId?: { toString(): string } | null;
  minSubtotalCents?: number | null;
}

interface CouponRuleContext {
  userId: string;
  /** Subtotal de artículos antes del descuento, sin envío. */
  subtotalCents: number;
  now: Date;
}

const INVALID_MESSAGE = "Ese código no existe o ya no está disponible.";

const MONEY_FORMATTER = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function formatPesos(cents: number): string {
  return MONEY_FORMATTER.format(cents / 100);
}

/** El código se compara siempre en mayúsculas y sin espacios alrededor. */
function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

function invalid(): AppError {
  return new AppError(INVALID_MESSAGE, 409, undefined, ErrorCode.COUPON_INVALID);
}

function assertCouponApplicable(coupon: CouponRuleInput, context: CouponRuleContext): void {
  if (!coupon.isActive) throw invalid();
  if (coupon.startsAt && context.now.getTime() < coupon.startsAt.getTime()) throw invalid();
  if (coupon.kind === CouponKind.PERSONAL && coupon.assignedUserId?.toString() !== context.userId) throw invalid();

  if (coupon.endsAt && context.now.getTime() > coupon.endsAt.getTime()) {
    throw new AppError("Este cupón ya venció.", 409, undefined, ErrorCode.COUPON_EXPIRED);
  }

  const minimum = coupon.minSubtotalCents ?? 0;
  if (context.subtotalCents < minimum) {
    throw new AppError(
      `Este cupón aplica en compras desde ${formatPesos(minimum)}. Te faltan ${formatPesos(minimum - context.subtotalCents)} en productos.`,
      409,
      undefined,
      ErrorCode.COUPON_MIN_NOT_MET,
    );
  }
}

interface CouponCapacityInput {
  perCustomerLimit: number;
  maxCustomers?: number | null;
  customersCount: number;
}

/**
 * Lectura de los topes con contadores, para la VISTA PREVIA del checkout. No
 * reserva nada: quien decide de verdad es el update atómico de
 * `coupon-redemption.service.ts`. Una clienta que ya tiene un lugar (`uses > 0`)
 * sigue viendo el cupón aunque el tope de personas se haya llenado.
 */
function assertCouponHasRoom(coupon: CouponCapacityInput, currentUses: number): void {
  if (currentUses >= coupon.perCustomerLimit) {
    throw new AppError("Ya usaste este cupón.", 409, undefined, ErrorCode.COUPON_ALREADY_USED);
  }
  const hasCap = coupon.maxCustomers !== undefined && coupon.maxCustomers !== null;
  if (currentUses === 0 && hasCap && coupon.customersCount >= coupon.maxCustomers!) {
    throw new AppError("Este cupón ya alcanzó su límite de personas.", 409, undefined, ErrorCode.COUPON_EXHAUSTED);
  }
}

export { assertCouponApplicable, assertCouponHasRoom, normalizeCouponCode };
export type { CouponRuleInput, CouponRuleContext, CouponCapacityInput };
