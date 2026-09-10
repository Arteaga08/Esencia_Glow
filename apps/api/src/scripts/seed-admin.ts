import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { UserRole } from "@esencia-glow/shared";

/**
 * Seed idempotente del usuario admin, para poder probar 2FA y `restrictTo`
 * end-to-end. Solo lee SEED_ADMIN_* (nunca el server). Se rehúsa a correr
 * contra producción salvo `--force` explícito — un seed corrido por error
 * ahí podría resetear la contraseña del admin real.
 */

const FORCE_FLAG = "--force";

async function seedAdmin(): Promise<void> {
  if (env.isProduction && !process.argv.includes(FORCE_FLAG)) {
    throw new Error(
      "Seed rehusado en producción. Pasa --force si de verdad quieres correrlo aquí.",
    );
  }

  if (!env.seedAdminEmail || !env.seedAdminPassword) {
    throw new Error("SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son requeridas para el seed.");
  }

  await connectDatabase();

  const existing = await User.findOne({ email: env.seedAdminEmail }).select("+password");

  if (existing) {
    existing.password = env.seedAdminPassword;
    existing.role = UserRole.ADMIN;
    existing.emailVerified = true;
    await existing.save();
    logger.info({ email: "[redacted]" }, "Admin existente actualizado por el seed");
  } else {
    await User.create({
      email: env.seedAdminEmail,
      password: env.seedAdminPassword,
      firstName: "Admin",
      lastName: "Esencia Glow",
      role: UserRole.ADMIN,
      emailVerified: true,
    });
    logger.info({ email: "[redacted]" }, "Admin creado por el seed");
  }

  await disconnectDatabase();
}

seedAdmin()
  .then(() => {
    logger.info("Seed de admin completado");
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ err: error }, "Fallo el seed de admin");
    process.exit(1);
  });
