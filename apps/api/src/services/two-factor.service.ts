import { authenticator } from "otplib";
import QRCode from "qrcode";
import type { Types } from "mongoose";
import { AuthAction } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { revokeAllForUser } from "./session.service.js";
import { recordAudit } from "./audit.service.js";

/**
 * 2FA TOTP para cuentas admin (BACKEND_SECURITY_GUIDELINES.md §2). Secreto
 * cifrado at-rest, activación en dos pasos, login y desactivación exigen
 * código válido, desactivar revoca todas las sesiones activas.
 */

const ISSUER = "Esencia Glow";

interface SetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/** El label del QR es el email del usuario — se resuelve aquí, no lo decide el caller. */
async function setupTwoFactor(userId: Types.ObjectId | string): Promise<SetupResult> {
  const user = await User.findById(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "twoFactor.secret": encryptSecret(secret),
        "twoFactor.enabled": false,
        "twoFactor.pendingSince": new Date(),
      },
    },
  );

  return { secret, otpauthUrl, qrCodeDataUrl };
}

async function loadDecryptedSecret(userId: Types.ObjectId | string): Promise<{
  secret: string;
  enabled: boolean;
}> {
  const user = await User.findById(userId).select("+twoFactor.secret");
  if (!user?.twoFactor.secret) {
    throw new AppError("2FA no está configurado para esta cuenta", 400);
  }
  return { secret: decryptSecret(user.twoFactor.secret), enabled: user.twoFactor.enabled };
}

function assertValidCode(secret: string, code: string): void {
  const isValid = authenticator.verify({ token: code, secret });
  if (!isValid) {
    throw new AppError("Código de verificación incorrecto", 401);
  }
}

/** Nunca activa 2FA sin haber confirmado que el usuario genera códigos válidos. */
async function enableTwoFactor(userId: Types.ObjectId | string, code: string): Promise<void> {
  const { secret } = await loadDecryptedSecret(userId);
  assertValidCode(secret, code);

  await User.updateOne(
    { _id: userId },
    { $set: { "twoFactor.enabled": true }, $unset: { "twoFactor.pendingSince": "" } },
  );
  await recordAudit({ action: AuthAction.TWO_FACTOR_ENABLED, actorId: userId, targetId: userId });
}

/** Usado en el login de dos pasos y en cualquier verificación puntual del código. */
async function verifyTwoFactorCode(userId: Types.ObjectId | string, code: string): Promise<void> {
  const { secret, enabled } = await loadDecryptedSecret(userId);
  if (!enabled) throw new AppError("2FA no está activado para esta cuenta", 400);
  assertValidCode(secret, code);
}

/**
 * Exige un código válido (no basta con estar autenticado) y revoca todas las
 * sesiones activas: si un atacante ya tenía una sesión robada, apagar el 2FA
 * no debe dejarle esa sesión utilizable.
 */
async function disableTwoFactor(userId: Types.ObjectId | string, code: string): Promise<void> {
  const { secret, enabled } = await loadDecryptedSecret(userId);
  if (!enabled) throw new AppError("2FA no está activado para esta cuenta", 400);
  assertValidCode(secret, code);

  await User.updateOne(
    { _id: userId },
    { $set: { "twoFactor.enabled": false }, $unset: { "twoFactor.secret": "", "twoFactor.pendingSince": "" } },
  );
  await revokeAllForUser(userId);
  await recordAudit({ action: AuthAction.TWO_FACTOR_DISABLED, actorId: userId, targetId: userId });
}

export { setupTwoFactor, enableTwoFactor, verifyTwoFactorCode, disableTwoFactor };
export type { SetupResult };
