import bcrypt from "bcrypt";
import type { Types } from "mongoose";
import { AuthAction } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { VerificationToken } from "../models/verification-token.model.js";
import { SALT_ROUNDS } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { generateRawToken, hashToken } from "../utils/crypto.js";
import { sendPasswordChangedNotice, sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";
import { revokeAllForUser, revokeOtherSessions } from "./session.service.js";
import { recordAudit } from "./audit.service.js";

/**
 * Verificación de email y reset de contraseña. Tokens hasheados en DB, un
 * solo uso, TTL corto, y sin revelar si el email existe
 * (BACKEND_SECURITY_GUIDELINES.md, "Timing-oracle en flujos de autenticación").
 */

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

// Hash dummy precalculado: register/forgotPassword lo usan para que la rama
// "el email no existe" haga el mismo trabajo de CPU que la rama real, y así
// el tiempo de respuesta no filtre si la cuenta existe.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-timing-oracle-guard", SALT_ROUNDS);

async function issueVerificationToken(
  userId: Types.ObjectId | string,
  type: "email_verification" | "password_reset",
  ttlMs: number,
): Promise<string> {
  const raw = generateRawToken();
  await VerificationToken.create({
    userId,
    tokenHash: hashToken(raw),
    type,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return raw;
}

async function consumeVerificationToken(
  rawToken: string,
  type: "email_verification" | "password_reset",
) {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const consumed = await VerificationToken.findOneAndUpdate(
    { tokenHash, type, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );

  if (!consumed) {
    throw new AppError("Token inválido o expirado", 400);
  }

  return consumed;
}

async function resendVerification(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user || user.emailVerified) {
    await bcrypt.compare("dummy-timing-oracle-guard", DUMMY_PASSWORD_HASH);
    return;
  }

  const raw = await issueVerificationToken(user._id, "email_verification", EMAIL_VERIFICATION_TTL_MS);
  // Sin `await`: el envío es una llamada de red a Resend cuya latencia
  // dominaría por completo el trabajo de CPU que se iguala arriba, volviendo
  // a abrir el oráculo de tiempo que la rama "no existe" evita. sendEmail ya
  // atrapa sus propios errores — nunca deja una promesa sin manejar.
  void sendVerificationEmail(user.email, raw);
}

async function verifyEmail(rawToken: string): Promise<void> {
  const token = await consumeVerificationToken(rawToken, "email_verification");
  await User.updateOne({ _id: token.userId }, { $set: { emailVerified: true } });
  await recordAudit({ action: AuthAction.EMAIL_VERIFIED, actorId: token.userId, targetId: token.userId });
}

async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) {
    // Trabajo equivalente al de la rama real para uniformar el tiempo de
    // respuesta — nunca revela si el email existe.
    await bcrypt.compare("dummy-timing-oracle-guard", DUMMY_PASSWORD_HASH);
    return;
  }

  const raw = await issueVerificationToken(user._id, "password_reset", PASSWORD_RESET_TTL_MS);
  // Ídem resendVerification: no se espera el envío, para no reabrir el
  // oráculo de tiempo vía la latencia de red de Resend.
  void sendPasswordResetEmail(user.email, raw);
}

async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const token = await consumeVerificationToken(rawToken, "password_reset");

  const user = await User.findById(token.userId);
  if (!user) throw new AppError("Token inválido o expirado", 400);

  user.password = newPassword;
  await user.save();

  // Reset de contraseña cierra todas las sesiones — si un atacante tenía una
  // sesión viva, el reset legítimo se la quita.
  await revokeAllForUser(user._id);
  await recordAudit({ action: AuthAction.PASSWORD_RESET, actorId: user._id, targetId: user._id });
  void sendPasswordChangedNotice(user.email);
}

/**
 * Devuelve el usuario actualizado (no `void`) porque el controller necesita
 * `role`/`sessionVersion` para reemitir un access token nuevo: el `save()`
 * de abajo actualiza `passwordChangedAt`, así que el access token con el que
 * llegó esta request queda inválido en `protect` en su siguiente uso — sin
 * reemitirlo aquí, "cierra las demás sesiones" (la intención de este flujo)
 * terminaría cerrando también la que lo ejecutó.
 */
async function changePassword(
  userId: Types.ObjectId | string,
  currentPassword: string,
  newPassword: string,
  currentRawRefreshToken?: string,
) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError("Usuario no encontrado", 404);

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) throw new AppError("La contraseña actual no es correcta", 401);

  user.password = newPassword;
  await user.save();

  // Cierra las demás sesiones, no la que está ejecutando este cambio.
  await revokeOtherSessions(user._id, currentRawRefreshToken);
  await recordAudit({ action: AuthAction.PASSWORD_CHANGE, actorId: user._id, targetId: user._id });
  void sendPasswordChangedNotice(user.email);

  return user;
}

/** Usado por auth.service.register — mismo mecanismo de token que resendVerification. */
async function issueVerificationTokenForRegistration(userId: Types.ObjectId | string): Promise<string> {
  return issueVerificationToken(userId, "email_verification", EMAIL_VERIFICATION_TTL_MS);
}

export {
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  issueVerificationTokenForRegistration,
};
