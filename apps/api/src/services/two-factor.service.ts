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

// `window: 1` acepta también el código del período TOTP adyacente (±30s),
// no solo el exacto — estándar contra el desfase de reloj del dispositivo.
// Sin esto, un código generado justo al final de su período de 30s falla en
// el viaje de red, y la suite de tests (que genera y envía códigos en el
// mismo tick) queda intermitentemente frágil.
authenticator.options = { window: 1 };

const ISSUER = "Esencia Glow";
const ENROLLMENT_WINDOW_MS = 15 * 60 * 1000;

// Límite de intentos POR CUENTA (auditoría run-2, hallazgo 2). Un código de 6
// dígitos con ventana 1 se adivina con ~3 de cada millón de intentos: el límite
// por IP no alcanza (IPs rotativas, sesiones robadas), tiene que vivir en la
// cuenta y ser el mismo para todos los caminos que verifican un código.
const MAX_CODE_ATTEMPTS = 5;
const CODE_WINDOW_MS = 15 * 60 * 1000;
const CODE_LOCK_MS = 15 * 60 * 1000;
const TOTP_STEP_MS = 30_000;

interface SetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * El label del QR es el email del usuario — se resuelve aquí, no lo decide el
 * caller. Si la cuenta ya tiene 2FA activado, exige el código vigente antes
 * de reemplazar el secreto: si no, una sesión robada podría re-enrolar 2FA
 * con un secreto propio y burlar el step-up de reembolsos.
 */
async function setupTwoFactor(
  userId: Types.ObjectId | string,
  code?: string,
): Promise<SetupResult> {
  const user = await User.findById(userId).select("+twoFactor.secret");
  if (!user) throw new AppError("Usuario no encontrado", 404);

  if (user.twoFactor.enabled) {
    if (!code) {
      throw new AppError("Se requiere el código actual para reconfigurar 2FA", 401);
    }
    await assertValidCode(user._id, decryptSecret(user.twoFactor.secret!), code);
  }

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Secreto nuevo = contador de pasos nuevo (los pasos del secreto viejo no aplican).
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "twoFactor.secret": encryptSecret(secret),
        "twoFactor.enabled": false,
        "twoFactor.pendingSince": new Date(),
      },
      $unset: { "twoFactor.lastUsedStep": "" },
    },
  );

  return { secret, otpauthUrl, qrCodeDataUrl };
}

/**
 * Variante de `setupTwoFactor` para el enrolamiento OBLIGATORIO pre-auth de
 * un admin sin 2FA (auth.service.ts, login de dos pasos forzado). A
 * diferencia de `setupTwoFactor`, es idempotente: si ya hay un secreto
 * pendiente (`enabled: false`) generado hace menos de 15 minutos, lo reusa en
 * vez de rotarlo. Sin esto, cualquier recarga de la pantalla de enrolamiento
 * —o alguien con solo la contraseña, en un endpoint sin sesión— podría llamar
 * este setup en loop y el admin legítimo nunca terminaría de escanear un QR
 * que seguiría siendo válido: un DoS que lo deja fuera de su propia cuenta,
 * porque sin 2FA tampoco hay sesión.
 *
 * Nunca toca una cuenta que ya tiene 2FA activo — esa reconfiguración sigue
 * siendo exclusiva de `setupTwoFactor`, detrás de `protect` y con el código
 * vigente.
 */
async function ensureEnrollmentSecret(userId: Types.ObjectId | string): Promise<SetupResult> {
  const user = await User.findById(userId).select("+twoFactor.secret");
  if (!user) throw new AppError("Usuario no encontrado", 404);

  if (user.twoFactor.enabled) {
    throw new AppError("Esta cuenta ya tiene 2FA activo, inicia sesión de nuevo", 409);
  }

  const pendingSince = user.twoFactor.pendingSince;
  const withinWindow = pendingSince != null && Date.now() - pendingSince.getTime() < ENROLLMENT_WINDOW_MS;

  if (user.twoFactor.secret && withinWindow) {
    const secret = decryptSecret(user.twoFactor.secret);
    const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

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
      $unset: { "twoFactor.lastUsedStep": "" },
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

/**
 * Única puerta de verificación de códigos TOTP. Tres defensas, en este orden:
 *
 * 1. Reserva el intento ANTES de mirar el código, con una sola actualización
 *    atómica en BD: peticiones en paralelo no pueden colarse entre "leer el
 *    contador" y "sumar el fallo". Al intento número 6 la cuenta se bloquea 15
 *    minutos y ni el código correcto pasa (la dueña espera; el atacante no
 *    puede seguir adivinando).
 * 2. Verifica el código y obtiene el paso TOTP exacto en que fue válido.
 * 3. Acepta cada paso una sola vez (`lastUsedStep` solo avanza): un código
 *    espiado o ya usado en otro camino (ej. el de login) no sirve de nuevo.
 *
 * Acertar reinicia el contador. Un código repetido cuenta como intento fallido.
 */
async function assertValidCode(userId: Types.ObjectId | string, secret: string, code: string): Promise<void> {
  const now = new Date();
  const windowExpiredBefore = new Date(now.getTime() - CODE_WINDOW_MS);

  const reserved = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { "twoFactor.lockedUntil": { $exists: false } },
        { "twoFactor.lockedUntil": null },
        { "twoFactor.lockedUntil": { $lte: now } },
      ],
    },
    [
      {
        $set: {
          "twoFactor.failedAttempts": {
            $cond: [
              {
                $or: [
                  { $eq: [{ $ifNull: ["$twoFactor.failureWindowStart", null] }, null] },
                  { $lt: ["$twoFactor.failureWindowStart", windowExpiredBefore] },
                ],
              },
              1,
              { $add: [{ $ifNull: ["$twoFactor.failedAttempts", 0] }, 1] },
            ],
          },
          "twoFactor.failureWindowStart": {
            $cond: [
              {
                $or: [
                  { $eq: [{ $ifNull: ["$twoFactor.failureWindowStart", null] }, null] },
                  { $lt: ["$twoFactor.failureWindowStart", windowExpiredBefore] },
                ],
              },
              now,
              "$twoFactor.failureWindowStart",
            ],
          },
        },
      },
      {
        $set: {
          "twoFactor.lockedUntil": {
            $cond: [
              { $gt: ["$twoFactor.failedAttempts", MAX_CODE_ATTEMPTS] },
              new Date(now.getTime() + CODE_LOCK_MS),
              "$twoFactor.lockedUntil",
            ],
          },
        },
      },
    ],
    { new: true },
  );

  const lockedOut = (): AppError =>
    new AppError("Demasiados intentos con el código, intenta de nuevo en 15 minutos.", 429);

  // Sin documento = la cuenta ya estaba bloqueada (el filtro no la dejó pasar).
  if (!reserved) throw lockedOut();

  if ((reserved.twoFactor.failedAttempts ?? 0) > MAX_CODE_ATTEMPTS) {
    // Solo el intento que cruza el umbral audita: los siguientes ya no entran aquí.
    await recordAudit({ action: AuthAction.TWO_FACTOR_LOCKED, actorId: userId, targetId: userId });
    throw lockedOut();
  }

  // Un solo instante para verificar Y calcular el paso: si el paso TOTP cambia entre las
  // dos lecturas, `lastUsedStep` quedaría un paso atrás y el código se aceptaría otra vez.
  const verifiedAt = Date.now();
  const delta = authenticator.clone({ epoch: verifiedAt }).checkDelta(code, secret);
  if (delta === null) {
    throw new AppError("Código de verificación incorrecto", 401);
  }

  const step = Math.floor(verifiedAt / TOTP_STEP_MS) + delta;
  const accepted = await User.updateOne(
    {
      _id: userId,
      $or: [{ "twoFactor.lastUsedStep": { $exists: false } }, { "twoFactor.lastUsedStep": { $lt: step } }],
    },
    {
      $set: { "twoFactor.lastUsedStep": step },
      $unset: { "twoFactor.failedAttempts": "", "twoFactor.failureWindowStart": "", "twoFactor.lockedUntil": "" },
    },
  );
  if (accepted.modifiedCount === 0) {
    throw new AppError("Ese código ya se usó, espera al siguiente.", 401);
  }
}

/** Nunca activa 2FA sin haber confirmado que el usuario genera códigos válidos. */
async function enableTwoFactor(userId: Types.ObjectId | string, code: string): Promise<void> {
  const { secret, enabled } = await loadDecryptedSecret(userId);
  // Con 2FA ya activo, "activar" solo serviría para saber si un código es válido
  // (200 vs 401): se corta antes de mirar el código.
  if (enabled) throw new AppError("Esta cuenta ya tiene 2FA activo", 409);
  await assertValidCode(userId, secret, code);

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
  await assertValidCode(userId, secret, code);
}

/**
 * Exige un código válido (no basta con estar autenticado) y revoca todas las
 * sesiones activas: si un atacante ya tenía una sesión robada, apagar el 2FA
 * no debe dejarle esa sesión utilizable.
 */
async function disableTwoFactor(userId: Types.ObjectId | string, code: string): Promise<void> {
  const { secret, enabled } = await loadDecryptedSecret(userId);
  if (!enabled) throw new AppError("2FA no está activado para esta cuenta", 400);
  await assertValidCode(userId, secret, code);

  await User.updateOne(
    { _id: userId },
    {
      $set: { "twoFactor.enabled": false },
      $unset: {
        "twoFactor.secret": "",
        "twoFactor.pendingSince": "",
        "twoFactor.failedAttempts": "",
        "twoFactor.failureWindowStart": "",
        "twoFactor.lockedUntil": "",
        "twoFactor.lastUsedStep": "",
      },
    },
  );
  await revokeAllForUser(userId);
  await recordAudit({ action: AuthAction.TWO_FACTOR_DISABLED, actorId: userId, targetId: userId });
}

export { setupTwoFactor, ensureEnrollmentSecret, enableTwoFactor, verifyTwoFactorCode, disableTwoFactor };
export type { SetupResult };
