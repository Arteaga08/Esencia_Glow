import type { Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `env` es un singleton congelado que se construye una sola vez al
 * importarse config/env.ts (ver tests/setup.ts). Para probar los dos
 * comportamientos de `COOKIE_DOMAIN` (ausente vs. presente) en el mismo
 * archivo hace falta reconstruir ese singleton con `vi.resetModules()` +
 * import dinámico DESPUÉS de fijar `process.env.COOKIE_DOMAIN` — el mismo
 * patrón que ya usa tests/setup.ts para los providers fake.
 */

function fakeResponse(): Response & { calls: Array<{ name: string; value?: string; options: Record<string, unknown> }> } {
  const calls: Array<{ name: string; value?: string; options: Record<string, unknown> }> = [];
  return {
    calls,
    cookie(name: string, value: string, options: Record<string, unknown>) {
      calls.push({ name, value, options });
      return this;
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      calls.push({ name, options });
      return this;
    },
  } as unknown as Response & { calls: typeof calls };
}

describe("utils/cookies — alcance de dominio (COOKIE_DOMAIN)", () => {
  afterEach(() => {
    delete process.env.COOKIE_DOMAIN;
    vi.resetModules();
  });

  it("sin COOKIE_DOMAIN, las cookies de sesión son host-only (sin campo domain)", async () => {
    delete process.env.COOKIE_DOMAIN;
    vi.resetModules();
    const { setAuthCookies, clearAuthCookies } = await import("../../src/utils/cookies.js");

    const res = fakeResponse();
    setAuthCookies(res, { accessToken: "a", refreshToken: "r" });
    clearAuthCookies(res);

    expect(res.calls.length).toBeGreaterThan(0);
    for (const call of res.calls) {
      expect(call.options).not.toHaveProperty("domain");
    }
  });

  it("con COOKIE_DOMAIN fijado, las tres cookies de sesión lo llevan (set y clear)", async () => {
    process.env.COOKIE_DOMAIN = ".esenciaglow.example";
    vi.resetModules();
    const {
      setAuthCookies,
      setPendingTwoFactorCookie,
      clearAuthCookies,
    } = await import("../../src/utils/cookies.js");

    const res = fakeResponse();
    setAuthCookies(res, { accessToken: "a", refreshToken: "r" });
    setPendingTwoFactorCookie(res, "p");
    clearAuthCookies(res);

    expect(res.calls.length).toBeGreaterThan(0);
    for (const call of res.calls) {
      expect(call.options.domain).toBe(".esenciaglow.example");
    }
  });

  /**
   * Regresión de code review (Milestone 2.1): `completeTwoFactorLogin`
   * limpiaba `pending_2fa_token` con un `res.clearCookie` crudo, sin pasar
   * por `baseCookieOptions()` — con `COOKIE_DOMAIN` fijado en producción, el
   * navegador ignora un `clearCookie` que no repite el mismo `domain` con el
   * que se puso la cookie, dejándola viva.
   */
  it("clearPendingTwoFactorCookie repite el mismo domain con el que se puso la cookie", async () => {
    process.env.COOKIE_DOMAIN = ".esenciaglow.example";
    vi.resetModules();
    const { setPendingTwoFactorCookie, clearPendingTwoFactorCookie } = await import(
      "../../src/utils/cookies.js"
    );

    const res = fakeResponse();
    setPendingTwoFactorCookie(res, "p");
    clearPendingTwoFactorCookie(res);

    const setCall = res.calls.find((call) => call.value !== undefined);
    const clearCall = res.calls.find((call) => call.value === undefined);
    expect(setCall?.options.domain).toBe(".esenciaglow.example");
    expect(clearCall?.options.domain).toBe(setCall?.options.domain);
  });
});
