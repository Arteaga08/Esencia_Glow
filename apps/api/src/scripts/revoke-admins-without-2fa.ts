import { pathToFileURL } from "node:url";
import { UserRole } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { revokeAllForUser } from "../services/session.service.js";

/**
 * Paso de despliegue único del enrolamiento obligatorio de 2FA (Milestone
 * 2.1): revoca las sesiones de cualquier admin que ya estuviera logueado
 * ANTES de este cambio sin tener 2FA activo. Es una optimización, no el
 * mecanismo de seguridad — `protect` y `refresh` (middlewares/protect.ts,
 * controllers/auth.controller.ts) ya rechazan por sí solos a un admin sin
 * 2FA en el siguiente request que hagan, con o sin este script. Correrlo
 * antes cierra esas sesiones de inmediato en vez de esperar a que expiren
 * por su cuenta.
 *
 * Se corre DESPUÉS de desplegar el backend con la guarda ya activa, nunca
 * antes: si corriera primero, cualquier admin que loguee en la ventana
 * intermedia (con el código viejo, sin la guarda) recuperaría una sesión sin
 * 2FA que este script ya no vería.
 */
interface RevokeAdminsWithoutTwoFactorResult {
  revokedCount: number;
}

async function revokeAdminsWithoutTwoFactor(): Promise<RevokeAdminsWithoutTwoFactorResult> {
  const admins = await User.find({ role: UserRole.ADMIN, "twoFactor.enabled": false }).select("_id");
  await Promise.all(admins.map((admin) => revokeAllForUser(admin._id)));
  return { revokedCount: admins.length };
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    const result = await revokeAdminsWithoutTwoFactor();
    logger.info({ revokedCount: result.revokedCount }, "Sesiones de admins sin 2FA revocadas");
  } finally {
    await disconnectDatabase();
  }
}

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .then(() => {
      logger.info("Revocación de admins sin 2FA completada");
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Falló la revocación de admins sin 2FA");
      process.exit(1);
    });
}

export { revokeAdminsWithoutTwoFactor };
