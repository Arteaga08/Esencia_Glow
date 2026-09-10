import type { Response } from "express";
import { env } from "../config/env.js";
import { parseDurationToMs, PENDING_TWO_FACTOR_TTL_MS } from "./jwt.js";

/**
 * Único lugar donde se arman las cookies de sesión — así los flags de
 * seguridad (BACKEND_SECURITY_GUIDELINES.md §1) nunca se repiten ni se
 * olvidan en un endpoint nuevo.
 *
 * El refresh token usa `path` acotado a `/api/v1/auth` para no viajar en
 * cada request del sitio (el access token sí necesita ir en toda ruta
 * protegida, así que usa `path: "/"`).
 */

const ACCESS_COOKIE_NAME = "access_token";
const REFRESH_COOKIE_NAME = "refresh_token";
const PENDING_TWO_FACTOR_COOKIE_NAME = "pending_2fa_token";

const ACCESS_COOKIE_MAX_AGE_FALLBACK_MS = 15 * 60 * 1000;

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict" as const,
  };
}

// Deriva el maxAge del mismo valor que firma el JWT (env.accessTokenTtl) —
// nunca dos fuentes de verdad para la vida útil del access token.
function accessCookieMaxAgeMs(): number {
  return parseDurationToMs(env.accessTokenTtl, ACCESS_COOKIE_MAX_AGE_FALLBACK_MS);
}

function refreshCookieMaxAgeMs(): number {
  return env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
}

function setAccessCookie(res: Response, accessToken: string): void {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...baseCookieOptions(),
    path: "/",
    maxAge: accessCookieMaxAgeMs(),
  });
}

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  setAccessCookie(res, tokens.accessToken);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...baseCookieOptions(),
    path: "/api/v1/auth",
    maxAge: refreshCookieMaxAgeMs(),
  });
}

function setPendingTwoFactorCookie(res: Response, token: string): void {
  res.cookie(PENDING_TWO_FACTOR_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    path: "/api/v1/auth",
    maxAge: PENDING_TWO_FACTOR_TTL_MS,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { ...baseCookieOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...baseCookieOptions(), path: "/api/v1/auth" });
  res.clearCookie(PENDING_TWO_FACTOR_COOKIE_NAME, { ...baseCookieOptions(), path: "/api/v1/auth" });
}

export {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  PENDING_TWO_FACTOR_COOKIE_NAME,
  setAccessCookie,
  setAuthCookies,
  setPendingTwoFactorCookie,
  clearAuthCookies,
};
