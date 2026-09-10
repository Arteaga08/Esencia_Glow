import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { AuthAction } from "@esencia-glow/shared";
import { generateRawToken, hashToken } from "../utils/crypto.js";
import { Session } from "../models/session.model.js";
import { User } from "../models/user.model.js";
import { recordAudit } from "./audit.service.js";

/**
 * Refresh tokens revocables, con rotación atómica y detección de reuso
 * (BACKEND_SECURITY_GUIDELINES.md §11). Toda la lógica de sesiones vive aquí
 * — el controller solo mueve el refresh token entre cookie y este service.
 */

interface SessionMeta {
  userAgent?: string;
}

interface IssuedSession {
  rawToken: string;
  expiresAt: Date;
  userId: Types.ObjectId;
}

function refreshExpiresAt(): Date {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

async function issueSession(
  userId: Types.ObjectId | string,
  meta: SessionMeta = {},
  familyId: string = randomUUID(),
): Promise<IssuedSession> {
  const rawToken = generateRawToken();
  const expiresAt = refreshExpiresAt();
  const objectId = new Types.ObjectId(userId);

  await Session.create({
    userId: objectId,
    tokenHash: hashToken(rawToken),
    familyId,
    userAgent: meta.userAgent,
    expiresAt,
  });

  return { rawToken, expiresAt, userId: objectId };
}

/**
 * Revoca toda la familia de un refresh token comprometido: si un atacante ya
 * rotó el token robado, el usuario legítimo que reintente con el suyo (ya
 * inválido) dispara esto, y así también el token que el atacante obtuvo
 * queda inservible.
 */
async function revokeFamily(familyId: string): Promise<void> {
  await Session.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/**
 * Rotación atómica: un solo `findOneAndUpdate` condicionado a
 * `revokedAt: null` decide quién gana una carrera entre dos requests con el
 * mismo refresh token. El perdedor —o cualquier reuso posterior de un token
 * ya rotado— revoca la familia entera, no solo ese token.
 */
async function rotateSession(rawToken: string, meta: SessionMeta = {}): Promise<IssuedSession> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const revoked = await Session.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: now, rotatedAt: now } },
  );

  if (!revoked) {
    const existing = await Session.findOne({ tokenHash });
    if (existing) {
      await revokeFamily(existing.familyId);
      await recordAudit({ action: AuthAction.SESSION_REUSE_DETECTED, actorId: existing.userId });
    }
    throw new AppError("Sesión inválida, inicia sesión de nuevo", 401);
  }

  if (revoked.expiresAt < now) {
    throw new AppError("Sesión expirada, inicia sesión de nuevo", 401);
  }

  return issueSession(revoked.userId, meta, revoked.familyId);
}

async function revokeSession(rawToken: string): Promise<void> {
  await Session.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/**
 * Cierra todas las sesiones vivas de un usuario y sube `sessionVersion`: esto
 * último es lo que invalida de inmediato los access tokens ya emitidos (son
 * JWT no revocables por sí mismos — ver middlewares/protect.ts). Se usa en
 * reset de contraseña (flujo no autenticado: no hay "sesión actual" que
 * preservar) y al desactivar 2FA (el estándar exige matar toda sesión activa
 * sin excepción, sin importar que sea la que ejecutó la acción).
 */
async function revokeAllForUser(userId: Types.ObjectId | string): Promise<void> {
  await Promise.all([
    Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),
    User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } }),
  ]);
}

/**
 * Igual que `revokeAllForUser` pero preserva la sesión que ejecuta la acción
 * (no sube `sessionVersion`, así el access token actual sigue siendo válido).
 * Se usa en cambio de contraseña autenticado ("cierra las demás sesiones",
 * no la que el usuario está usando en este momento).
 */
async function revokeOtherSessions(userId: Types.ObjectId | string, currentRawToken?: string): Promise<void> {
  const currentHash = currentRawToken ? hashToken(currentRawToken) : undefined;
  await Session.updateMany(
    { userId, revokedAt: null, ...(currentHash ? { tokenHash: { $ne: currentHash } } : {}) },
    { $set: { revokedAt: new Date() } },
  );
}

export { issueSession, rotateSession, revokeSession, revokeAllForUser, revokeOtherSessions };
export type { IssuedSession, SessionMeta };
