import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { User } from "../../src/models/user.model.js";
import { VerificationToken } from "../../src/models/verification-token.model.js";
import { hashToken } from "../../src/utils/crypto.js";
import {
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from "../../src/services/account.service.js";
import { issueSession, rotateSession } from "../../src/services/session.service.js";

async function createUser(overrides: Partial<{ emailVerified: boolean }> = {}) {
  return User.create({
    email: `user-${new Types.ObjectId().toHexString()}@example.com`,
    password: "Contrasena1",
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: overrides.emailVerified ?? false,
  });
}

describe("services/account — verificación de email", () => {
  it("un token válido marca emailVerified y queda usado (un solo uso)", async () => {
    const user = await createUser();
    const raw = "raw-verification-token";
    await VerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(raw),
      type: "email_verification",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await verifyEmail(raw);

    const reloaded = await User.findById(user._id);
    expect(reloaded?.emailVerified).toBe(true);

    // Reusar el mismo token ya no funciona.
    await expect(verifyEmail(raw)).rejects.toThrow();
  });

  it("un token expirado se rechaza", async () => {
    const user = await createUser();
    const raw = "expired-token";
    await VerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(raw),
      type: "email_verification",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(verifyEmail(raw)).rejects.toThrow();
  });

  it("un token inexistente se rechaza", async () => {
    await expect(verifyEmail("token-que-no-existe")).rejects.toThrow();
  });
});

describe("services/account — recuperación de contraseña", () => {
  it("forgotPassword con email inexistente no lanza (respuesta genérica)", async () => {
    await expect(forgotPassword("no-existe@example.com")).resolves.toBeUndefined();
  });

  it("forgotPassword con email existente crea un token de tipo password_reset", async () => {
    const user = await createUser();
    await forgotPassword(user.email);

    const token = await VerificationToken.findOne({ userId: user._id, type: "password_reset" });
    expect(token).not.toBeNull();
  });

  it("resetPassword con token válido cambia la contraseña y consume el token", async () => {
    const user = await createUser();
    const raw = "raw-reset-token";
    await VerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(raw),
      type: "password_reset",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await resetPassword(raw, "NuevaContrasena1");

    const reloaded = await User.findById(user._id).select("+password");
    expect(await reloaded!.comparePassword("NuevaContrasena1")).toBe(true);

    await expect(resetPassword(raw, "OtraContrasena1")).rejects.toThrow();
  });
});

describe("services/account — cambio de contraseña autenticado", () => {
  it("rechaza con la contraseña actual incorrecta y no toca nada", async () => {
    const user = await createUser();
    await expect(
      changePassword(user._id, "ContrasenaIncorrecta1", "NuevaContrasena1"),
    ).rejects.toThrow();
  });

  it("cambia la contraseña, revoca las demás sesiones y preserva la sesión actual", async () => {
    const user = await createUser();
    const otherSession = await issueSession(user._id);
    const currentSession = await issueSession(user._id);

    const updated = await changePassword(
      user._id,
      "Contrasena1",
      "NuevaContrasena1",
      currentSession.rawToken,
    );
    expect(updated.email).toBe(user.email);

    // La contraseña nueva funciona.
    const reloaded = await User.findById(user._id).select("+password");
    expect(await reloaded!.comparePassword("NuevaContrasena1")).toBe(true);

    // La sesión que NO se usó para el cambio queda revocada.
    await expect(rotateSession(otherSession.rawToken)).rejects.toThrow();

    // La sesión actual (el refresh token con el que se hizo el cambio) sigue viva.
    await expect(rotateSession(currentSession.rawToken)).resolves.toBeDefined();
  });
});
