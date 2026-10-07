import { ErrorCode } from "@esencia-glow/shared";
import type { Failure } from "../auth-errors";

/**
 * Parte pura del cupón en el checkout (sin red ni DOM): normalizar lo que la
 * clienta escribe y traducir un fallo del API a un mensaje para su campo. Vive
 * aparte de `coupon.ts` (que llama al API) para poder probarse sin navegador.
 */

/** El servidor compara en mayúsculas y sin espacios; la pantalla hace lo mismo para que lo escrito y lo aplicado coincidan. */
function normalizeCouponInput(raw: string): string {
  return raw.trim().toUpperCase();
}

const COUPON_ERROR_CODES: readonly ErrorCode[] = [
  ErrorCode.COUPON_INVALID,
  ErrorCode.COUPON_EXPIRED,
  ErrorCode.COUPON_EXHAUSTED,
  ErrorCode.COUPON_ALREADY_USED,
  ErrorCode.COUPON_MIN_NOT_MET,
];

function isCouponErrorCode(code: ErrorCode | undefined): boolean {
  return code !== undefined && COUPON_ERROR_CODES.includes(code);
}

/**
 * ¿El fallo dice que el cupón YA NO aplica? Solo entonces la revalidación
 * silenciosa lo quita. Un fallo de red, un 5xx, el límite de intentos, la
 * sesión vencida o un artículo agotado no dicen nada del cupón: se conserva.
 */
function isCouponRuleFailure(failure: Failure): boolean {
  return isCouponErrorCode(failure.code);
}

/**
 * Mensaje para pintar pegado al campo del cupón. Los fallos propios del cupón
 * (y los del carrito) ya vienen del API en español y en lenguaje humano, así
 * que se muestran tal cual; solo se reescriben los que no dicen nada útil.
 */
function couponFailureMessage(failure: Failure): string {
  if (failure.kind === "unauthorized") return "Tu sesión venció. Inicia sesión otra vez para usar tu cupón.";
  if (failure.kind === "invalid") return "Escribe el código de tu cupón.";
  return failure.message;
}

export { normalizeCouponInput, isCouponErrorCode, isCouponRuleFailure, couponFailureMessage };
