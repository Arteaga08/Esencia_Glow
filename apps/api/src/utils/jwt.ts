import jwt from "jsonwebtoken";
import type { UserRole } from "@esencia-glow/shared";
import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

/**
 * Firma y verificación de JWT. El access token es corto y no revocable por
 * diseño (ver session.model.ts para lo revocable). `purpose` distingue el
 * access token normal de los dos tokens efímeros de login pendiente — cada
 * `verify*` rechaza un token cuyo purpose no le corresponde, para que
 * ninguno de los dos jamás pase por `protect`.
 *
 * `pending_2fa` (login con 2FA ya activo, exige el código) y
 * `pending_2fa_setup` (login de un admin sin 2FA, exige enrolar) son
 * `purpose` DISTINTOS a propósito, aunque hoy viajan en la misma cookie: si
 * compartieran uno, el pending token de una cuenta que YA tiene 2FA activo
 * serviría también para llamar al endpoint de enrolamiento y reemplazar su
 * secreto — 2FA degradado a solo-contraseña para quien tenga la contraseña.
 * Ambos llevan `sessionVersion` y se verifican contra el usuario al
 * canjearse (auth.service.ts): sin eso, una revocación masiva o un cambio de
 * contraseña ocurridos dentro de la ventana de 5 minutos del token no lo
 * invalidarían.
 */

const PENDING_TWO_FACTOR_TTL_MS = 5 * 60 * 1000;
const PENDING_TWO_FACTOR_TTL = "5m";

/** Duración legible ("15m", "30s", "1h", "7d") a milisegundos, para derivar el
 * `maxAge` de la cookie del mismo valor que firma el JWT — nunca dos fuentes
 * de verdad para la misma vida útil (ver utils/cookies.ts). */
function parseDurationToMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) return fallbackMs;
  const unit = match[2] as "s" | "m" | "h" | "d";
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return Number(match[1]) * unitMs;
}

interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  sessionVersion: number;
}

// `sub` es opcional en JwtPayload; aquí es siempre requerido, así que se
// excluye del tipo base antes de re-declararlo vía AccessTokenClaims.
interface AccessTokenPayload extends Omit<jwt.JwtPayload, "sub">, AccessTokenClaims {
  purpose: "access";
}

interface PendingTwoFactorClaims {
  sub: string;
  sessionVersion: number;
}

interface PendingTwoFactorPayload extends Omit<jwt.JwtPayload, "sub">, PendingTwoFactorClaims {
  purpose: "pending_2fa";
}

interface PendingEnrollmentClaims {
  sub: string;
  sessionVersion: number;
}

interface PendingEnrollmentPayload extends Omit<jwt.JwtPayload, "sub">, PendingEnrollmentClaims {
  purpose: "pending_2fa_setup";
}

function signAccessToken(claims: AccessTokenClaims): string {
  const payload: AccessTokenPayload = { ...claims, purpose: "access" };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"] });
}

function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  if (decoded.purpose !== "access") {
    throw new AppError("No autenticado", 401);
  }
  return decoded as AccessTokenPayload;
}

function signPendingTwoFactorToken(claims: PendingTwoFactorClaims): string {
  const payload: PendingTwoFactorPayload = { ...claims, purpose: "pending_2fa" };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: PENDING_TWO_FACTOR_TTL });
}

function verifyPendingTwoFactorToken(token: string): PendingTwoFactorPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  if (decoded.purpose !== "pending_2fa") {
    throw new AppError("No hay un inicio de sesión pendiente de verificación", 401);
  }
  return decoded as PendingTwoFactorPayload;
}

function signPendingEnrollmentToken(claims: PendingEnrollmentClaims): string {
  const payload: PendingEnrollmentPayload = { ...claims, purpose: "pending_2fa_setup" };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: PENDING_TWO_FACTOR_TTL });
}

function verifyPendingEnrollmentToken(token: string): PendingEnrollmentPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  if (decoded.purpose !== "pending_2fa_setup") {
    throw new AppError("No hay un inicio de sesión pendiente de verificación", 401);
  }
  return decoded as PendingEnrollmentPayload;
}

export {
  signAccessToken,
  verifyAccessToken,
  signPendingTwoFactorToken,
  verifyPendingTwoFactorToken,
  signPendingEnrollmentToken,
  verifyPendingEnrollmentToken,
  parseDurationToMs,
  PENDING_TWO_FACTOR_TTL_MS,
};
export type { AccessTokenPayload, PendingTwoFactorPayload, PendingEnrollmentPayload };
