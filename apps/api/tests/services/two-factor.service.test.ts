import { authenticator } from "otplib";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { AuthAction } from "@esencia-glow/shared";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { User } from "../../src/models/user.model.js";
import {
  enableTwoFactor,
  ensureEnrollmentSecret,
  verifyTwoFactorCode,
} from "../../src/services/two-factor.service.js";
import { totpAtOffset } from "../helpers/totp.js";

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
  it("el enrolamiento genera un secreto pendiente (enabled: false) y no lo expone en claro", async () => {
    const user = await createUser();
    const setup = await ensureEnrollmentSecret(user._id);

    expect(setup.otpauthUrl).toContain("otpauth://totp/");
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const reloaded = await User.findById(user._id).select("+twoFactor.secret");
    expect(reloaded?.twoFactor.enabled).toBe(false);
    expect(reloaded?.twoFactor.secret).toBeDefined();
    expect(reloaded?.twoFactor.secret).not.toContain(setup.secret);
  });

  it("enable con un código inválido no activa 2FA", async () => {
    const user = await createUser();
    await ensureEnrollmentSecret(user._id);

    await expect(enableTwoFactor(user._id, "000000")).rejects.toThrow();

    const reloaded = await User.findById(user._id);
    expect(reloaded?.twoFactor.enabled).toBe(false);
  });

  it("enable con un código válido activa 2FA", async () => {
    const user = await createUser();
    const setup = await ensureEnrollmentSecret(user._id);
    const validCode = authenticator.generate(setup.secret);

    await enableTwoFactor(user._id, validCode);

    const reloaded = await User.findById(user._id);
    expect(reloaded?.twoFactor.enabled).toBe(true);
  });

  it("verifyTwoFactorCode valida contra el secreto ya activado", async () => {
    const user = await createUser();
    const setup = await ensureEnrollmentSecret(user._id);
    await enableTwoFactor(user._id, totpAtOffset(setup.secret, -1));

    // El servicio no acepta dos veces el mismo paso: se usa el siguiente.
    const nextCode = totpAtOffset(setup.secret, 0);
    await expect(verifyTwoFactorCode(user._id, nextCode)).resolves.toBeUndefined();
    await expect(verifyTwoFactorCode(user._id, "111111")).rejects.toThrow();
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
    const setup = await ensureEnrollmentSecret(user._id);
    await enableTwoFactor(user._id, authenticator.generate(setup.secret));

    await expect(ensureEnrollmentSecret(user._id)).rejects.toThrow();
  });
});

/** Cuenta con 2FA ya activo; devuelve el secreto en claro para generar códigos. */
async function createUserWithTwoFactor() {
  const user = await createUser();
  const setup = await ensureEnrollmentSecret(user._id);
  await enableTwoFactor(user._id, totpAtOffset(setup.secret, -1));
  return { user, secret: setup.secret };
}

describe("services/two-factor — límite de intentos por cuenta", () => {
  it("5 códigos incorrectos bloquean la cuenta: el sexto responde 429 aunque sea el código correcto", async () => {
    const { user, secret } = await createUserWithTwoFactor();

    for (let i = 0; i < 5; i += 1) {
      await expect(verifyTwoFactorCode(user._id, "000000")).rejects.toMatchObject({ statusCode: 401 });
    }
    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).rejects.toMatchObject({ statusCode: 429 });
  });

  it("el bloqueo también vale para el enrolamiento (enable con secreto pendiente)", async () => {
    const user = await createUser();
    const setup = await ensureEnrollmentSecret(user._id);
    for (let i = 0; i < 5; i += 1) await enableTwoFactor(user._id, "000000").catch(() => undefined);

    await expect(enableTwoFactor(user._id, totpAtOffset(setup.secret, 0))).rejects.toMatchObject({ statusCode: 429 });
    expect((await User.findById(user._id))?.twoFactor.enabled).toBe(false);
  });

  it("los fallos de caminos distintos suman en el mismo contador (login/2fa + reembolso)", async () => {
    const { user, secret } = await createUserWithTwoFactor();

    await expect(verifyTwoFactorCode(user._id, "000000")).rejects.toThrow();
    await expect(verifyTwoFactorCode(user._id, "111111")).rejects.toThrow();
    await expect(verifyTwoFactorCode(user._id, "222222")).rejects.toThrow();
    await expect(verifyTwoFactorCode(user._id, "333333")).rejects.toThrow();
    await expect(verifyTwoFactorCode(user._id, "444444")).rejects.toThrow();

    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).rejects.toMatchObject({ statusCode: 429 });
  });

  it("al acertar se reinicia el contador de fallos", async () => {
    const { user, secret } = await createUserWithTwoFactor();

    for (let i = 0; i < 4; i += 1) await verifyTwoFactorCode(user._id, "000000").catch(() => undefined);
    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).resolves.toBeUndefined();

    // Cuatro fallos más no bloquean: el contador volvió a cero.
    for (let i = 0; i < 4; i += 1) await verifyTwoFactorCode(user._id, "000000").catch(() => undefined);
    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 1))).resolves.toBeUndefined();
  });

  it("pasados 15 minutos el bloqueo termina y el código correcto vuelve a funcionar", async () => {
    const { user, secret } = await createUserWithTwoFactor();
    for (let i = 0; i < 5; i += 1) await verifyTwoFactorCode(user._id, "000000").catch(() => undefined);
    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).rejects.toMatchObject({ statusCode: 429 });

    // Se retrocede el reloj guardado (no fake timers: ver el test de ensureEnrollmentSecret).
    const past = new Date(Date.now() - 16 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      { $set: { "twoFactor.lockedUntil": new Date(Date.now() - 1000), "twoFactor.failureWindowStart": past } },
    );

    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).resolves.toBeUndefined();
  });

  it("los fallos viejos (fuera de la ventana de 15 minutos) no se acumulan", async () => {
    const { user, secret } = await createUserWithTwoFactor();
    for (let i = 0; i < 4; i += 1) await verifyTwoFactorCode(user._id, "000000").catch(() => undefined);
    await User.updateOne(
      { _id: user._id },
      { $set: { "twoFactor.failureWindowStart": new Date(Date.now() - 16 * 60 * 1000) } },
    );

    await expect(verifyTwoFactorCode(user._id, "000000")).rejects.toMatchObject({ statusCode: 401 });
    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).resolves.toBeUndefined();
  });

  it("intentos en paralelo no se cuelan: a lo más 5 llegan a verificarse", async () => {
    const { user, secret } = await createUserWithTwoFactor();

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => verifyTwoFactorCode(user._id, "000000")),
    );
    const verified = results.filter((r) => r.status === "rejected" && (r.reason as { statusCode: number }).statusCode === 401);
    expect(verified.length).toBeLessThanOrEqual(5);

    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).rejects.toMatchObject({ statusCode: 429 });
  });

  it("deja un registro de auditoría cuando la cuenta se bloquea", async () => {
    const { user } = await createUserWithTwoFactor();
    for (let i = 0; i < 7; i += 1) await verifyTwoFactorCode(user._id, "000000").catch(() => undefined);

    const entries = await AuditLog.find({ action: AuthAction.TWO_FACTOR_LOCKED, targetId: user._id });
    expect(entries).toHaveLength(1);
  });
});

describe("services/two-factor — un código aceptado no se acepta otra vez", () => {
  it("el mismo código no sirve dos veces", async () => {
    const { user, secret } = await createUserWithTwoFactor();
    const code = totpAtOffset(secret, 0);

    await expect(verifyTwoFactorCode(user._id, code)).resolves.toBeUndefined();
    await expect(verifyTwoFactorCode(user._id, code)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("un código de un paso anterior al último aceptado tampoco sirve", async () => {
    const { user, secret } = await createUserWithTwoFactor();

    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 1))).resolves.toBeUndefined();
    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 0))).rejects.toMatchObject({ statusCode: 401 });
  });

  it("un código reusado cuenta como intento fallido (no es un oráculo gratis)", async () => {
    const { user, secret } = await createUserWithTwoFactor();
    const code = totpAtOffset(secret, 0);
    await verifyTwoFactorCode(user._id, code);

    for (let i = 0; i < 5; i += 1) await verifyTwoFactorCode(user._id, code).catch(() => undefined);
    await expect(verifyTwoFactorCode(user._id, totpAtOffset(secret, 1))).rejects.toMatchObject({ statusCode: 429 });
  });

});

describe("services/two-factor — enable sobre una cuenta con 2FA ya activo", () => {
  it("responde 409 sin mirar el código (ya no es un oráculo de validez)", async () => {
    const { user, secret } = await createUserWithTwoFactor();

    await expect(enableTwoFactor(user._id, "000000")).rejects.toMatchObject({ statusCode: 409 });
    await expect(enableTwoFactor(user._id, totpAtOffset(secret, 0))).rejects.toMatchObject({ statusCode: 409 });

    // Ni siquiera gasta intentos del contador por cuenta.
    const reloaded = await User.findById(user._id);
    expect(reloaded?.twoFactor.failedAttempts ?? 0).toBe(0);
  });
});
