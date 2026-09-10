import { describe, expect, it } from "vitest";
import { UserRole } from "@esencia-glow/shared";
import {
  signAccessToken,
  signPendingTwoFactorToken,
  verifyAccessToken,
  verifyPendingTwoFactorToken,
} from "../../src/utils/jwt.js";

describe("utils/jwt — tokens de acceso y de segundo factor pendiente", () => {
  it("firma y verifica un access token con los claims esperados", () => {
    const token = signAccessToken({ sub: "user-1", role: UserRole.CUSTOMER, sessionVersion: 0 });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe(UserRole.CUSTOMER);
    expect(payload.sessionVersion).toBe(0);
  });

  it("rechaza un token con firma inválida", () => {
    const token = signAccessToken({ sub: "user-1", role: UserRole.CUSTOMER, sessionVersion: 0 });
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("un token pending_2fa no es aceptado por verifyAccessToken (purpose cruzado)", () => {
    const pending = signPendingTwoFactorToken({ sub: "user-1" });
    expect(() => verifyAccessToken(pending)).toThrow();
  });

  it("un access token no es aceptado por verifyPendingTwoFactorToken (purpose cruzado)", () => {
    const access = signAccessToken({ sub: "user-1", role: UserRole.CUSTOMER, sessionVersion: 0 });
    expect(() => verifyPendingTwoFactorToken(access)).toThrow();
  });

  it("verifyPendingTwoFactorToken acepta el token correcto y expone el sub", () => {
    const pending = signPendingTwoFactorToken({ sub: "user-42" });
    const payload = verifyPendingTwoFactorToken(pending);
    expect(payload.sub).toBe("user-42");
  });
});
