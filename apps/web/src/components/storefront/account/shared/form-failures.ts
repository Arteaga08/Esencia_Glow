import { ErrorCode } from "@esencia-glow/shared";
import type { Failure } from "@/lib/storefront/auth-errors";

/**
 * Qué pinta cada formulario ante un fallo del API. Decide por `code` (estable),
 * nunca por el texto del mensaje: el texto es lenguaje humano y puede cambiar.
 */

// Un solo texto para cualquier credencial que no entra: nunca dice si el correo
// existe (anti-enumeración). Solo quien ya acertó la contraseña se entera de que
// su cuenta falta verificar.
const CREDENTIALS_ERROR = "Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.";

const CURRENT_PASSWORD_ERROR = "Esa no es tu contraseña actual. Revísala e inténtalo de nuevo.";

interface PasswordChangeFailure {
  /** Errores pegados a su campo (`current`, `next`). */
  errors: Record<string, string>;
  /** Error general del formulario cuando no es de un campo. */
  formError: string | null;
}

/**
 * Cambio de contraseña. Un 401 sin código ya lo refrescó y reintentó
 * `accountRequest` (y redirigió si la sesión se acabó), así que aquí solo
 * queda el 401 de dominio: la actual está mal.
 */
function mapPasswordChangeFailure(failure: Failure): PasswordChangeFailure {
  if (failure.code === ErrorCode.CURRENT_PASSWORD_INCORRECT) return { errors: { current: CURRENT_PASSWORD_ERROR }, formError: null };
  if (failure.fieldErrors.newPassword) return { errors: { next: failure.fieldErrors.newPassword }, formError: null };
  if (failure.kind === "invalid" && /filtraciones/i.test(failure.message)) return { errors: { next: failure.message }, formError: null };
  return { errors: {}, formError: failure.message };
}

type LoginFailure = { kind: "unverified" } | { kind: "message"; message: string };

/** Ingreso: solo `EMAIL_NOT_VERIFIED` es "verifica tu correo"; cualquier otro 403 dice lo que dice el API. */
function mapLoginFailure(failure: Failure): LoginFailure {
  if (failure.code === ErrorCode.EMAIL_NOT_VERIFIED) return { kind: "unverified" };
  if (failure.kind === "invalid" || failure.kind === "unauthorized") return { kind: "message", message: CREDENTIALS_ERROR };
  return { kind: "message", message: failure.message };
}

export { CREDENTIALS_ERROR, mapLoginFailure, mapPasswordChangeFailure };
export type { LoginFailure, PasswordChangeFailure };
