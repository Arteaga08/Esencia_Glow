import bcrypt from "bcrypt";
import type { Types } from "mongoose";
import { AuthAction } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { VerificationToken } from "../models/verification-token.model.js";
import { SALT_ROUNDS } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { generateRawToken, hashToken } from "../utils/crypto.js";
import { sendPasswordChangedNotice, sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";
import { assertPasswordNotBreached } from "./password-breach.service.js";
import { revokeAllForUser, revokeOtherSessions } from "./session.service.js";
import { recordAudit } from "./audit.service.js";

/**
 * Verificación de email y reset de contraseña. Tokens hasheados en DB, un
 * solo uso, TTL corto, y sin revelar si el email existe
 * (BACKEND_SECURITY_GUIDELINES.md, "Timing-oracle en flujos de autenticación").
 */

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
// Un correo por minuto por cuenta y tipo: sin esto, "reenviar"/"olvidé" sirven
// para bombardear una bandeja ajena (el limitador por IP/correo es la 1.ª
// barrera; este enfriamiento vive en el servidor y no depende de la memoria
// de un proceso).
const TOKEN_COOLDOWN_MS = 60 * 1000;
const DUMMY_PLAIN_PASSWORD = "dummy-timing-oracle-guard";

// Hash dummy precalculado: register/forgotPassword lo usan para que la rama
// "el email no existe" haga el mismo trabajo de CPU que la rama real, y así
// el tiempo de respuesta no filtre si la cuenta existe.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-timing-oracle-guard", SALT_ROUNDS);

/**
 * Emite un token nuevo y mata los anteriores del mismo tipo: con varios
 * enlaces vivos a la vez, el correo viejo de una bandeja comprometida seguiría
 * sirviendo. Con `cooldownMs`, si ya se emitió uno hace menos de ese tiempo
 * devuelve `null` (no se manda correo) y la respuesta al cliente sigue siendo
 * la misma genérica.
 */
async function issueVerificationToken(
  userId: Types.ObjectId | string,
  type: "email_verification" | "password_reset",
  ttlMs: number,
  options: { cooldownMs?: number } = {},
): Promise<string | null> {
  const now = new Date();
  if (options.cooldownMs) {
    const recent = await VerificationToken.exists({
      userId,
      type,
      usedAt: null,
      createdAt: { $gt: new Date(now.getTime() - options.cooldownMs) },
    });
    if (recent) return null;
  }

  await VerificationToken.updateMany({ userId, type, usedAt: null }, { $set: { usedAt: now } });

  const raw = generateRawToken();
  await VerificationToken.create({
    userId,
    tokenHash: hashToken(raw),
    type,
    expiresAt: new Date(now.getTime() + ttlMs),
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

/**
 * Las tres ramas ("no existe", "ya verificada", "se manda") pagan el mismo
 * bcrypt en paralelo con la consulta: antes solo la rama "no existe" lo hacía,
 * así que el tiempo de respuesta distinguía cuentas reales de inexistentes.
 */
async function lookupWithEqualizedTiming(email: string) {
  const [user] = await Promise.all([User.findOne({ email }), bcrypt.compare(DUMMY_PLAIN_PASSWORD, DUMMY_PASSWORD_HASH)]);
  return user;
}

async function resendVerification(email: string): Promise<void> {
  const user = await lookupWithEqualizedTiming(email);
  if (!user || user.emailVerified) return;

  const raw = await issueVerificationToken(user._id, "email_verification", EMAIL_VERIFICATION_TTL_MS, {
    cooldownMs: TOKEN_COOLDOWN_MS,
  });
  if (!raw) return;
  // Sin `await`: la latencia de red de Resend reabriría el oráculo de tiempo.
  // sendEmail ya atrapa sus propios errores — nunca deja una promesa sin manejar.
  void sendVerificationEmail(user.email, raw);
}

/**
 * Exige la contraseña de la cuenta además del token (anti pre-hijacking): quien
 * registra el correo de otra persona con una contraseña propia no puede
 * aprovechar que la víctima abra el enlace, porque ella no la conoce. El token
 * solo se consume si la contraseña es correcta, así un error de dedo no lo
 * quema. La rama "token inexistente" paga el mismo bcrypt.
 */
async function verifyEmail(rawToken: string, password: string): Promise<void> {
  const token = await VerificationToken.findOne({
    tokenHash: hashToken(rawToken),
    type: "email_verification",
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  const user = token ? await User.findById(token.userId).select("+password") : null;
  const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);

  if (!token || !user) throw new AppError("Token inválido o expirado", 400);
  if (!passwordMatches) throw new AppError("La contraseña no coincide con la de tu cuenta", 401);

  // El consumo atómico sigue siendo la única puerta de uso único.
  await consumeVerificationToken(rawToken, "email_verification");
  await User.updateOne({ _id: user._id }, { $set: { emailVerified: true } });
  await recordAudit({ action: AuthAction.EMAIL_VERIFIED, actorId: user._id, targetId: user._id });
}

async function forgotPassword(email: string): Promise<void> {
  const user = await lookupWithEqualizedTiming(email);
  if (!user) return;

  const raw = await issueVerificationToken(user._id, "password_reset", PASSWORD_RESET_TTL_MS, {
    cooldownMs: TOKEN_COOLDOWN_MS,
  });
  if (!raw) return;
  void sendPasswordResetEmail(user.email, raw);
}

async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  // Antes de consumir el token: una contraseña filtrada no debe quemar el enlace.
  await assertPasswordNotBreached(newPassword);
  const token = await consumeVerificationToken(rawToken, "password_reset");

  const user = await User.findById(token.userId);
  if (!user) throw new AppError("Token inválido o expirado", 400);

  user.password = newPassword;
  // El enlace llegó a la bandeja de la persona: también prueba que el correo es suyo.
  user.emailVerified = true;
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
  await assertPasswordNotBreached(newPassword);

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
  // Sin enfriamiento: registrarse de nuevo sobre una cuenta sin verificar
  // reemplaza el enlace anterior (ver auth.service.register); lo limita el
  // limitador por correo de la ruta.
  const raw = await issueVerificationToken(userId, "email_verification", EMAIL_VERIFICATION_TTL_MS);
  if (!raw) throw new Error("issueVerificationToken sin enfriamiento nunca devuelve null");
  return raw;
}

export {
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  issueVerificationTokenForRegistration,
};
