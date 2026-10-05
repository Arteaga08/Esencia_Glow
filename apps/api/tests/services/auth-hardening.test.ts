import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../src/models/user.model.js";
import { VerificationToken } from "../../src/models/verification-token.model.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/utils/crypto.js";
import { verifyAccessToken } from "../../src/utils/jwt.js";
import * as emailService from "../../src/services/email.service.js";
import {
  changePassword,
  forgotPassword,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "../../src/services/account.service.js";
import { register } from "../../src/services/auth.service.js";
import { __setPasswordBreachCheckerForTests } from "../../src/services/password-breach.service.js";

/**
 * Endurecimiento del flujo de cuentas de cliente (Milestone 3.5): verificar el
 * correo exige la contraseña (anti pre-hijacking), contraseñas filtradas se
 * rechazan, los tokens viejos mueren al pedir uno nuevo y cada correo tiene
 * enfriamiento.
 */

const PASSWORD = "Contrasena1";

async function createUser(overrides: Partial<{ emailVerified: boolean; email: string }> = {}) {
  return User.create({
    email: overrides.email ?? `user-${new Types.ObjectId().toHexString()}@example.com`,
    password: PASSWORD,
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: overrides.emailVerified ?? false,
  });
}

async function seedToken(userId: Types.ObjectId, raw: string, type: "email_verification" | "password_reset", ageMs = 0) {
  return VerificationToken.create({
    userId,
    tokenHash: hashToken(raw),
    type,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(Date.now() - ageMs),
  });
}

beforeEach(() => {
  vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
  vi.spyOn(emailService, "sendPasswordResetEmail").mockResolvedValue(undefined);
  vi.spyOn(emailService, "sendPasswordChangedNotice").mockResolvedValue(undefined);
  __setPasswordBreachCheckerForTests(async () => false);
});

describe("verifyEmail exige la contraseña de la cuenta (anti pre-hijacking)", () => {
  it("con la contraseña correcta verifica el correo", async () => {
    const user = await createUser();
    await seedToken(user._id, "tok-ok", "email_verification");

    await verifyEmail("tok-ok", PASSWORD);

    expect((await User.findById(user._id))?.emailVerified).toBe(true);
  });

  it("con una contraseña incorrecta rechaza, no verifica y NO quema el token", async () => {
    const user = await createUser();
    await seedToken(user._id, "tok-bad", "email_verification");

    await expect(verifyEmail("tok-bad", "OtraContrasena1")).rejects.toMatchObject({ statusCode: 401 });

    expect((await User.findById(user._id))?.emailVerified).toBe(false);
    // El token sigue vivo: quien se equivocó de tecla puede reintentar.
    await verifyEmail("tok-bad", PASSWORD);
    expect((await User.findById(user._id))?.emailVerified).toBe(true);
  });

  it("un token que no existe se rechaza igual que uno vencido (mismo error)", async () => {
    await expect(verifyEmail("no-existe", PASSWORD)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("contraseñas filtradas", () => {
  it("register rechaza una contraseña filtrada ANTES de buscar el correo, igual exista o no", async () => {
    __setPasswordBreachCheckerForTests(async () => true);
    const existing = await createUser({ emailVerified: true });

    for (const email of [existing.email, "nuevo@example.com"]) {
      await expect(register({ email, password: PASSWORD, firstName: "Ana", lastName: "Pérez" })).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    expect(await User.findOne({ email: "nuevo@example.com" })).toBeNull();
  });

  it("resetPassword rechaza una contraseña filtrada sin quemar el token", async () => {
    const user = await createUser({ emailVerified: true });
    await seedToken(user._id, "tok-reset", "password_reset");
    __setPasswordBreachCheckerForTests(async () => true);

    await expect(resetPassword("tok-reset", "Filtrada12345")).rejects.toMatchObject({ statusCode: 400 });

    __setPasswordBreachCheckerForTests(async () => false);
    await resetPassword("tok-reset", "Distinta12345");
    const reloaded = await User.findById(user._id).select("+password");
    expect(await bcrypt.compare("Distinta12345", reloaded!.password)).toBe(true);
  });

  it("changePassword rechaza una contraseña filtrada y deja la actual intacta", async () => {
    const user = await createUser({ emailVerified: true });
    __setPasswordBreachCheckerForTests(async () => true);

    await expect(changePassword(user._id, PASSWORD, "Filtrada12345")).rejects.toMatchObject({ statusCode: 400 });

    const reloaded = await User.findById(user._id).select("+password");
    expect(await bcrypt.compare(PASSWORD, reloaded!.password)).toBe(true);
  });
});

describe("restablecer la contraseña prueba que el correo es de la persona", () => {
  it("resetPassword marca el correo como verificado", async () => {
    const user = await createUser({ emailVerified: false });
    await seedToken(user._id, "tok-reset", "password_reset");

    await resetPassword("tok-reset", "Nueva12345678");

    expect((await User.findById(user._id))?.emailVerified).toBe(true);
  });
});

describe("tokens de un solo correo: enfriamiento e invalidación de los anteriores", () => {
  it("forgotPassword dos veces seguidas no manda ni crea un segundo token", async () => {
    const user = await createUser({ emailVerified: true });

    await forgotPassword(user.email);
    await forgotPassword(user.email);

    expect(await VerificationToken.countDocuments({ userId: user._id, type: "password_reset" })).toBe(1);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("pasado el enfriamiento, el token nuevo invalida el anterior", async () => {
    const user = await createUser({ emailVerified: true });
    await seedToken(user._id, "tok-viejo", "password_reset", 5 * 60_000);

    await forgotPassword(user.email);

    await expect(resetPassword("tok-viejo", "Nueva12345678")).rejects.toMatchObject({ statusCode: 400 });
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("resendVerification respeta el mismo enfriamiento", async () => {
    const user = await createUser({ emailVerified: false });

    await resendVerification(user.email);
    await resendVerification(user.email);

    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});

describe("registro con un correo que ya existe", () => {
  it("si la cuenta NO está verificada, la nueva contraseña la reemplaza y el token anterior muere", async () => {
    const user = await createUser({ emailVerified: false });
    await seedToken(user._id, "tok-viejo", "email_verification", 5 * 60_000);

    await register({ email: user.email, password: "OtraContrasena1", firstName: "Bea", lastName: "Soto" });

    const reloaded = await User.findById(user._id).select("+password");
    expect(await bcrypt.compare("OtraContrasena1", reloaded!.password)).toBe(true);
    expect(reloaded?.firstName).toBe("Bea");
    await expect(verifyEmail("tok-viejo", "OtraContrasena1")).rejects.toMatchObject({ statusCode: 400 });
    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("si la cuenta YA está verificada no cambia nada ni manda correo", async () => {
    const user = await createUser({ emailVerified: true });

    await register({ email: user.email, password: "OtraContrasena1", firstName: "Bea", lastName: "Soto" });

    const reloaded = await User.findById(user._id).select("+password");
    expect(await bcrypt.compare(PASSWORD, reloaded!.password)).toBe(true);
    expect(reloaded?.firstName).toBe("Ana");
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("JWT con algoritmo fijado", () => {
  it("rechaza un access token firmado con otro algoritmo aunque use el mismo secreto", () => {
    const forged = jwt.sign({ sub: "x", role: "customer", sessionVersion: 0, purpose: "access" }, env.jwtSecret, {
      algorithm: "HS512",
    });
    expect(() => verifyAccessToken(forged)).toThrow();
  });
});
