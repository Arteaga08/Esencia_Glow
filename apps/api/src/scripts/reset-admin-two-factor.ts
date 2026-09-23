import { pathToFileURL } from "node:url";
import { AuthAction, UserRole } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { revokeAllForUser } from "../services/session.service.js";
import { recordAudit } from "../services/audit.service.js";

/**
 * Rescate para el enrolamiento obligatorio de 2FA de admins (Milestone 2.1):
 * `/2fa/disable` está tras `protect`, así que si el único admin de la cuenta
 * enrola en un dispositivo que después pierde (o nunca llega a terminar el
 * enrolamiento), queda fuera de su propia cuenta para siempre — no hay
 * ningún otro camino de recuperación. Este script resetea el 2FA de un admin
 * por correo, sin exigir una sesión ya autenticada, y revoca sus sesiones
 * activas por el mismo motivo que `disableTwoFactor` en two-factor.service.ts:
 * si el dispositivo perdido tenía una sesión viva, resetear el 2FA sin
 * revocarla la dejaría utilizable.
 *
 * Correrlo requiere acceso directo al servidor/infra (Railway run, SSH), lo
 * que ya es la barrera de autorización — no hay verificación adicional
 * dentro del script más que confirmar que la cuenta existe y es admin.
 */

const EMAIL_FLAG_PREFIX = "--email=";
const FORCE_FLAG = "--force";

interface ResetAdminTwoFactorOptions {
  email: string;
}

interface ResetAdminTwoFactorResult {
  outcome: "reset" | "not-found";
}

/**
 * Núcleo sin `connectDatabase()`/`disconnectDatabase()` propios (mismo
 * criterio que `seed-admin.ts`/`sync-indexes.ts`): opera sobre la conexión
 * de Mongoose que ya esté activa, para que los tests reusen la del
 * `MongoMemoryReplSet` compartido de `tests/setup.ts`.
 */
async function resetAdminTwoFactor(
  options: ResetAdminTwoFactorOptions,
): Promise<ResetAdminTwoFactorResult> {
  const admin = await User.findOne({ email: options.email, role: UserRole.ADMIN });
  if (!admin) return { outcome: "not-found" };

  await User.updateOne(
    { _id: admin._id },
    {
      $set: { "twoFactor.enabled": false },
      $unset: { "twoFactor.secret": "", "twoFactor.pendingSince": "" },
    },
  );
  await revokeAllForUser(admin._id);
  await recordAudit({ action: AuthAction.TWO_FACTOR_DISABLED, actorId: admin._id, targetId: admin._id });

  return { outcome: "reset" };
}

/** Entrypoint de CLI: `tsx src/scripts/reset-admin-two-factor.ts --email=admin@ejemplo.com [--force en producción]`. */
async function main(): Promise<void> {
  const emailArg = process.argv.find((arg) => arg.startsWith(EMAIL_FLAG_PREFIX));
  if (!emailArg) {
    throw new Error(`Uso: reset-admin-two-factor.ts ${EMAIL_FLAG_PREFIX}admin@ejemplo.com [${FORCE_FLAG}]`);
  }
  const email = emailArg.slice(EMAIL_FLAG_PREFIX.length).trim().toLowerCase();
  if (!email) {
    throw new Error("El correo no puede estar vacío.");
  }

  if (env.isProduction && !process.argv.includes(FORCE_FLAG)) {
    throw new Error(`Reset rehusado en producción. Pasa ${FORCE_FLAG} si de verdad quieres correrlo aquí.`);
  }

  await connectDatabase();
  try {
    const result = await resetAdminTwoFactor({ email });
    if (result.outcome === "not-found") {
      logger.warn({ email: "[redacted]" }, "No se encontró un admin con ese correo");
    } else {
      logger.info(
        { email: "[redacted]" },
        "2FA reseteado y sesiones revocadas; el admin deberá volver a enrolar en el próximo login",
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .then(() => {
      logger.info("Reset de 2FA de admin completado");
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Fallo el reset de 2FA de admin");
      process.exit(1);
    });
}

export { resetAdminTwoFactor };
