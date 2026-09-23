import { authenticator } from "otplib";
import { UserRole } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { User } from "../../src/models/user.model.js";
import { Session } from "../../src/models/session.model.js";
import {
  beginTwoFactorEnrollment,
  completeTwoFactorEnrollment,
  login,
} from "../../src/services/auth.service.js";
import { verifyPendingEnrollmentToken } from "../../src/utils/jwt.js";
import { enableTwoFactor, setupTwoFactor } from "../../src/services/two-factor.service.js";

const PASSWORD = "Contrasena1";

async function createUser(overrides: Partial<{ role: UserRole }> = {}) {
  return User.create({
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: PASSWORD,
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: true,
    role: overrides.role ?? UserRole.CUSTOMER,
  });
}

describe("services/auth — login() decide sesión vs. segundo factor vs. enrolamiento obligatorio", () => {
  it("un customer sin 2FA recibe sesión directa", async () => {
    const user = await createUser({ role: UserRole.CUSTOMER });
    const result = await login({ email: user.email, password: PASSWORD }, {});

    expect(result.outcome).toBe("session");
  });

  it("un admin sin 2FA NO recibe sesión: outcome es twoFactorSetupRequired y no se crea ninguna sesión en BD", async () => {
    const user = await createUser({ role: UserRole.ADMIN });
    const result = await login({ email: user.email, password: PASSWORD }, {});

    expect(result.outcome).toBe("twoFactorSetupRequired");
    if (result.outcome !== "twoFactorSetupRequired") throw new Error("unreachable");
    expect(result.pendingToken).toBeTruthy();

    const sessions = await Session.find({ userId: user._id });
    expect(sessions).toHaveLength(0);
  });

  it("un admin con 2FA activo mantiene el flujo existente (twoFactorRequired)", async () => {
    const user = await createUser({ role: UserRole.ADMIN });
    const setup = await setupTwoFactor(user._id);
    await enableTwoFactor(user._id, authenticator.generate(setup.secret));

    const result = await login({ email: user.email, password: PASSWORD }, {});
    expect(result.outcome).toBe("twoFactorRequired");

    const sessions = await Session.find({ userId: user._id });
    expect(sessions).toHaveLength(0);
  });

  it("el pendingToken de un admin sin 2FA trae purpose de enrolamiento, no el de login-2FA", async () => {
    const user = await createUser({ role: UserRole.ADMIN });
    const result = await login({ email: user.email, password: PASSWORD }, {});
    if (result.outcome !== "twoFactorSetupRequired") throw new Error("unreachable");

    const payload = verifyPendingEnrollmentToken(result.pendingToken);
    expect(payload.sub).toBe(user._id.toString());
    expect(payload.sessionVersion).toBe(user.sessionVersion);
  });
});

describe("services/auth — enrolamiento pre-auth (beginTwoFactorEnrollment / completeTwoFactorEnrollment)", () => {
  async function loginAsAdminPendingEnrollment() {
    const user = await createUser({ role: UserRole.ADMIN });
    const result = await login({ email: user.email, password: PASSWORD }, {});
    if (result.outcome !== "twoFactorSetupRequired") throw new Error("unreachable");
    const { sub, sessionVersion } = verifyPendingEnrollmentToken(result.pendingToken);
    return { user, sub, sessionVersion };
  }

  it("beginTwoFactorEnrollment devuelve QR + código manual y dos llamadas dan el mismo secreto", async () => {
    const { sub, sessionVersion } = await loginAsAdminPendingEnrollment();

    const first = await beginTwoFactorEnrollment(sub, sessionVersion);
    const second = await beginTwoFactorEnrollment(sub, sessionVersion);

    expect(first.manualEntryKey).toBe(second.manualEntryKey);
    expect(first.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("beginTwoFactorEnrollment rechaza un sessionVersion desalineado (sesión revocada entretanto)", async () => {
    const { user, sub } = await loginAsAdminPendingEnrollment();
    await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });

    await expect(beginTwoFactorEnrollment(sub, 0)).rejects.toThrow();
  });

  it("completeTwoFactorEnrollment activa 2FA, emite sesión y audita LOGIN además de TWO_FACTOR_ENABLED", async () => {
    const { sub, sessionVersion } = await loginAsAdminPendingEnrollment();
    const enrollment = await beginTwoFactorEnrollment(sub, sessionVersion);
    const code = authenticator.generate(enrollment.manualEntryKey);

    const { session, user } = await completeTwoFactorEnrollment(sub, sessionVersion, code, {});

    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();

    const reloaded = await User.findById(sub);
    expect(reloaded?.twoFactor.enabled).toBe(true);

    // Login siguiente ya no debe pedir enrolamiento, sino el segundo paso normal.
    const nextLogin = await login({ email: user.email, password: PASSWORD }, {});
    expect(nextLogin.outcome).toBe("twoFactorRequired");
  });

  it("completeTwoFactorEnrollment con código inválido no activa 2FA ni crea sesión", async () => {
    const { sub, sessionVersion } = await loginAsAdminPendingEnrollment();
    await beginTwoFactorEnrollment(sub, sessionVersion);

    await expect(completeTwoFactorEnrollment(sub, sessionVersion, "000000", {})).rejects.toThrow();

    const reloaded = await User.findById(sub);
    expect(reloaded?.twoFactor.enabled).toBe(false);

    const sessions = await Session.find({ userId: sub });
    expect(sessions).toHaveLength(0);
  });
});
