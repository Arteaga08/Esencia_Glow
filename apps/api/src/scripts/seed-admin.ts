import { pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { UserRole } from "@esencia-glow/shared";

/**
 * Seed idempotente del usuario admin, para poder probar 2FA y `restrictTo`
 * end-to-end. Se rehúsa a correr contra producción salvo `--force` explícito
 * — un seed corrido por error ahí podría resetear la contraseña del admin
 * real. En producción, además, si el admin YA existe no se toca su
 * contraseña salvo `--overwrite-existing` explícito (Milestone 1.10): este
 * script se corre una vez con `railway run` para crear el primer admin, y
 * una segunda corrida accidental (p. ej. por hábito) no debe resetear en
 * silencio la contraseña del admin real. Fuera de producción sí sobrescribe
 * sin flag adicional — es el comportamiento de siempre para desarrollo.
 */

const FORCE_FLAG = "--force";
const OVERWRITE_EXISTING_FLAG = "--overwrite-existing";

interface SeedAdminOptions {
  email: string;
  password: string;
  allowOverwriteExisting: boolean;
}

interface SeedAdminResult {
  outcome: "created" | "updated";
}

/**
 * Núcleo sin `connectDatabase()`/`disconnectDatabase()` propios (mismo
 * criterio que `sync-indexes.ts`): opera sobre la conexión de Mongoose que
 * ya esté activa, para que los tests puedan reusar la del
 * `MongoMemoryReplSet` compartido de `tests/setup.ts` sin reconectar.
 * También recibe `email`/`password` explícitos en vez de leer `env.seedAdmin*`
 * — así un test no depende de reconstruir el singleton de `env`.
 */
async function seedAdmin(options: SeedAdminOptions): Promise<SeedAdminResult> {
  const existing = await User.findOne({ email: options.email }).select("+password");

  if (existing) {
    if (!options.allowOverwriteExisting) {
      throw new Error(
        `Ya existe un admin con ese correo — el seed no lo toca sin ${OVERWRITE_EXISTING_FLAG}.`,
      );
    }
    existing.password = options.password;
    existing.role = UserRole.ADMIN;
    existing.emailVerified = true;
    await existing.save();
    logger.info({ email: "[redacted]" }, "Admin existente actualizado por el seed");
    return { outcome: "updated" };
  }

  await User.create({
    email: options.email,
    password: options.password,
    firstName: "Admin",
    lastName: "Esencia Glow",
    role: UserRole.ADMIN,
    emailVerified: true,
  });
  logger.info({ email: "[redacted]" }, "Admin creado por el seed");
  return { outcome: "created" };
}

/** Entrypoint de CLI: `node dist/scripts/seed-admin.js --force [--overwrite-existing]`. */
async function main(): Promise<void> {
  if (env.isProduction && !process.argv.includes(FORCE_FLAG)) {
    throw new Error(
      "Seed rehusado en producción. Pasa --force si de verdad quieres correrlo aquí.",
    );
  }

  if (!env.seedAdminEmail || !env.seedAdminPassword) {
    throw new Error("SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son requeridas para el seed.");
  }

  // Forma 1:1 con la regla en prosa del docstring de arriba: fuera de
  // producción siempre se permite; en producción, solo con el flag.
  const allowOverwriteExisting = env.isProduction
    ? process.argv.includes(OVERWRITE_EXISTING_FLAG)
    : true;

  await connectDatabase();
  try {
    await seedAdmin({
      email: env.seedAdminEmail,
      password: env.seedAdminPassword,
      allowOverwriteExisting,
    });
  } finally {
    await disconnectDatabase();
  }
}

// Solo se auto-ejecuta corrido directamente (CLI) — importar `seedAdmin`
// desde un test no debe conectar/desconectar la BD ni llamar process.exit().
// `pathToFileURL` (no una plantilla `file://${...}` a mano): con cualquier
// symlink en la ruta la comparación de strings nunca coincide y el script
// hace no-op en silencio — ver el mismo comentario en sync-indexes.ts.
const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .then(() => {
      logger.info("Seed de admin completado");
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Fallo el seed de admin");
      process.exit(1);
    });
}

export { seedAdmin };
