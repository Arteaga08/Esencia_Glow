import jwt from "jsonwebtoken";
import type { UserRole } from "@esencia-glow/shared";
import { env } from "../config/env.js";

/**
 * Firma y verificación de JWT. El access token es corto y no revocable por
 * diseño (ver session.model.ts para lo revocable). `purpose` distingue el
 * access token normal del token efímero de "login pendiente de 2FA" — cada
 * `verify*` rechaza un token cuyo purpose no le corresponde, para que un
 * token pendiente de 2FA jamás pase por `protect`.
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
}

interface PendingTwoFactorPayload extends Omit<jwt.JwtPayload, "sub">, PendingTwoFactorClaims {
  purpose: "pending_2fa";
}

function signAccessToken(claims: AccessTokenClaims): string {
  const payload: AccessTokenPayload = { ...claims, purpose: "access" };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"] });
}

function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  if (decoded.purpose !== "access") {
    throw new Error("Token no es un access token");
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
    throw new Error("Token no es un token de 2FA pendiente");
  }
  return decoded as PendingTwoFactorPayload;
}

export {
  signAccessToken,
  verifyAccessToken,
  signPendingTwoFactorToken,
  verifyPendingTwoFactorToken,
  parseDurationToMs,
  PENDING_TWO_FACTOR_TTL_MS,
};
export type { AccessTokenPayload, PendingTwoFactorPayload };
