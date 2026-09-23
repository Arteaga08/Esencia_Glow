import { describe, expect, it } from "vitest";
import { UserRole } from "@esencia-glow/shared";
import {
  signAccessToken,
  signPendingEnrollmentToken,
  signPendingTwoFactorToken,
  verifyAccessToken,
  verifyPendingEnrollmentToken,
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
    const pending = signPendingTwoFactorToken({ sub: "user-1", sessionVersion: 0 });
    expect(() => verifyAccessToken(pending)).toThrow();
  });

  it("un access token no es aceptado por verifyPendingTwoFactorToken (purpose cruzado)", () => {
    const access = signAccessToken({ sub: "user-1", role: UserRole.CUSTOMER, sessionVersion: 0 });
    expect(() => verifyPendingTwoFactorToken(access)).toThrow();
  });

  it("verifyPendingTwoFactorToken acepta el token correcto y expone sub y sessionVersion", () => {
    const pending = signPendingTwoFactorToken({ sub: "user-42", sessionVersion: 3 });
    const payload = verifyPendingTwoFactorToken(pending);
    expect(payload.sub).toBe("user-42");
    expect(payload.sessionVersion).toBe(3);
  });
});

describe("utils/jwt — token de enrolamiento de 2FA (purpose separado del de login-2FA)", () => {
  /**
   * Este es el test que justifica tener un `purpose` propio en vez de
   * reusar `pending_2fa`: sin esta separación, el pending token que recibe
   * cualquier login (incluido el de una cuenta que YA tiene 2FA activo)
   * serviría para llamar al endpoint de enrolamiento y reemplazar el
   * secreto de esa cuenta — 2FA degradado a solo-contraseña.
   */
  it("un token pending_2fa no es aceptado por verifyPendingEnrollmentToken (purpose cruzado)", () => {
    const loginTwoFactorToken = signPendingTwoFactorToken({ sub: "user-1", sessionVersion: 0 });
    expect(() => verifyPendingEnrollmentToken(loginTwoFactorToken)).toThrow();
  });

  it("un token pending_2fa_setup no es aceptado por verifyPendingTwoFactorToken (purpose cruzado)", () => {
    const enrollmentToken = signPendingEnrollmentToken({ sub: "user-1", sessionVersion: 0 });
    expect(() => verifyPendingTwoFactorToken(enrollmentToken)).toThrow();
  });

  it("un token de enrolamiento no es aceptado por verifyAccessToken (purpose cruzado)", () => {
    const enrollmentToken = signPendingEnrollmentToken({ sub: "user-1", sessionVersion: 0 });
    expect(() => verifyAccessToken(enrollmentToken)).toThrow();
  });

  it("verifyPendingEnrollmentToken acepta el token correcto y expone sub y sessionVersion", () => {
    const enrollmentToken = signPendingEnrollmentToken({ sub: "user-42", sessionVersion: 5 });
    const payload = verifyPendingEnrollmentToken(enrollmentToken);
    expect(payload.sub).toBe("user-42");
    expect(payload.sessionVersion).toBe(5);
  });
});
