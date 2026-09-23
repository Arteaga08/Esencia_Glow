import { authenticator } from "otplib";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { User } from "../../src/models/user.model.js";
import { Session } from "../../src/models/session.model.js";
import {
  disableTwoFactor,
  enableTwoFactor,
  ensureEnrollmentSecret,
  setupTwoFactor,
  verifyTwoFactorCode,
} from "../../src/services/two-factor.service.js";
import { issueSession } from "../../src/services/session.service.js";

async function createUser() {
  return User.create({
    email: `user-${new Types.ObjectId().toHexString()}@example.com`,
    password: "Contrasena1",
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: true,
  });
}

describe("services/two-factor — activación en dos pasos", () => {
  it("setup genera un secreto pendiente (enabled: false) y no lo expone en claro", async () => {
    const user = await createUser();
    const setup = await setupTwoFactor(user._id);

    expect(setup.otpauthUrl).toContain("otpauth://totp/");
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const reloaded = await User.findById(user._id).select("+twoFactor.secret");
    expect(reloaded?.twoFactor.enabled).toBe(false);
    expect(reloaded?.twoFactor.secret).toBeDefined();
    expect(reloaded?.twoFactor.secret).not.toContain(setup.secret);
  });

  it("enable con un código inválido no activa 2FA", async () => {
    const user = await createUser();
    await setupTwoFactor(user._id);

    await expect(enableTwoFactor(user._id, "000000")).rejects.toThrow();

    const reloaded = await User.findById(user._id);
    expect(reloaded?.twoFactor.enabled).toBe(false);
  });

  it("enable con un código válido activa 2FA", async () => {
    const user = await createUser();
    const setup = await setupTwoFactor(user._id);
    const validCode = authenticator.generate(setup.secret);

    await enableTwoFactor(user._id, validCode);

    const reloaded = await User.findById(user._id);
    expect(reloaded?.twoFactor.enabled).toBe(true);
  });

  it("verifyTwoFactorCode valida contra el secreto ya activado", async () => {
    const user = await createUser();
    const setup = await setupTwoFactor(user._id);
    const validCode = authenticator.generate(setup.secret);
    await enableTwoFactor(user._id, validCode);

    const nextCode = authenticator.generate(setup.secret);
    await expect(verifyTwoFactorCode(user._id, nextCode)).resolves.toBeUndefined();
    await expect(verifyTwoFactorCode(user._id, "111111")).rejects.toThrow();
  });

  it("setup con 2FA ya activado exige el código actual antes de reemplazar el secreto", async () => {
    const user = await createUser();
    const firstSetup = await setupTwoFactor(user._id);
    const firstValidCode = authenticator.generate(firstSetup.secret);
    await enableTwoFactor(user._id, firstValidCode);

    await expect(setupTwoFactor(user._id)).rejects.toThrow();
    await expect(setupTwoFactor(user._id, "000000")).rejects.toThrow();

    const untouched = await User.findById(user._id);
    expect(untouched?.twoFactor.enabled).toBe(true);

    const codeForResetup = authenticator.generate(firstSetup.secret);
    const secondSetup = await setupTwoFactor(user._id, codeForResetup);
    expect(secondSetup.secret).not.toBe(firstSetup.secret);

    const reloaded = await User.findById(user._id);
    expect(reloaded?.twoFactor.enabled).toBe(false);
  });

  it("disable exige un código válido y revoca todas las sesiones activas", async () => {
    const user = await createUser();
    const setup = await setupTwoFactor(user._id);
    const validCode = authenticator.generate(setup.secret);
    await enableTwoFactor(user._id, validCode);

    const session = await issueSession(user._id);

    await expect(disableTwoFactor(user._id, "000000")).rejects.toThrow();

    const codeForDisable = authenticator.generate(setup.secret);
    await disableTwoFactor(user._id, codeForDisable);

    const reloaded = await User.findById(user._id);
    expect(reloaded?.twoFactor.enabled).toBe(false);

    const sessionDoc = await Session.findOne({ userId: user._id });
    expect(sessionDoc?.revokedAt).toBeDefined();
    void session;
  });
});

describe("services/two-factor — ensureEnrollmentSecret (enrolamiento pre-auth)", () => {
  it("dos llamadas seguidas devuelven el mismo secreto (idempotente dentro de la ventana)", async () => {
    const user = await createUser();
    const first = await ensureEnrollmentSecret(user._id);
    const second = await ensureEnrollmentSecret(user._id);

    expect(second.secret).toBe(first.secret);
    expect(second.otpauthUrl).toBe(first.otpauthUrl);
  });

  it("tras expirar la ventana de 15 minutos, rota el secreto", async () => {
    const user = await createUser();
    const first = await ensureEnrollmentSecret(user._id);

    // Simula el paso del tiempo escribiendo `pendingSince` directo en BD, en
    // vez de fake timers: el driver de Mongo depende de sus propios timers
    // reales (heartbeats de la conexión), y congelarlos globalmente arriesga
    // colgar la suite en vez de solo esta prueba.
    await User.updateOne(
      { _id: user._id },
      { $set: { "twoFactor.pendingSince": new Date(Date.now() - 16 * 60 * 1000) } },
    );

    const second = await ensureEnrollmentSecret(user._id);
    expect(second.secret).not.toBe(first.secret);
  });

  it("nunca expone el secreto en claro en BD", async () => {
    const user = await createUser();
    const result = await ensureEnrollmentSecret(user._id);

    const reloaded = await User.findById(user._id).select("+twoFactor.secret");
    expect(reloaded?.twoFactor.enabled).toBe(false);
    expect(reloaded?.twoFactor.secret).not.toContain(result.secret);
  });

  it("se rehúsa si la cuenta ya tiene 2FA activo", async () => {
    const user = await createUser();
    const setup = await setupTwoFactor(user._id);
    await enableTwoFactor(user._id, authenticator.generate(setup.secret));

    await expect(ensureEnrollmentSecret(user._id)).rejects.toThrow();
  });
});
