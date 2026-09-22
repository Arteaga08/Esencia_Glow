import { pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { models } from "../models/index.js";

/**
 * Sync de índices como paso de despliegue (Milestone 1.10) — reemplaza al
 * `autoIndex` que `config/db.ts` apaga en producción. Se corre como
 * pre-deploy de Railway, ANTES de cortar tráfico hacia el código nuevo:
 * si falla, el exit code ≠ 0 aborta el deploy en vez de dejar la BD sin los
 * índices únicos que sostienen idempotencia de checkout, dedupe de eventos
 * de Stripe y cupo de plan.
 *
 * `createIndexes()` **solo agrega** — nunca borra ni recrea un índice
 * existente. Un `syncIndexes()` ciego de Mongoose sí lo haría (borra y
 * vuelve a crear cualquier índice cuya definición cambió), dejando una
 * ventana sin el índice único mientras corre; con tráfico real eso deja
 * pasar un duplicado exacto en esa ventana. `diffIndexes()` reporta los
 * índices sobrantes (`toDrop`, definidos en Mongo pero ya no en el schema)
 * sin tocarlos — borrarlos requiere el flag explícito `--prune`, nunca
 * automático.
 */
const PRUNE_FLAG = "--prune";

interface SyncIndexesOptions {
  /** Si es `true`, borra los índices sobrantes que reporta `diffIndexes()`. */
  prune: boolean;
}

interface SyncIndexesResult {
  /** `true` si algún modelo falló creando o difando sus índices. */
  hadFailure: boolean;
}

/**
 * Núcleo de la lógica, deliberadamente sin `connectDatabase()`/
 * `disconnectDatabase()` propios: opera sobre la conexión de Mongoose que
 * ya esté activa. El entrypoint de CLI de abajo la abre/cierra; los tests
 * reusan la conexión que ya levanta `tests/setup.ts` (un
 * `MongoMemoryReplSet` compartido) — llamar `connectDatabase()` otra vez ahí
 * reconectaría mongoose al `MONGODB_URI` placeholder de test y rompería la
 * conexión real del resto de la suite.
 */
async function syncIndexes(options: SyncIndexesOptions): Promise<SyncIndexesResult> {
  let hadFailure = false;

  for (const model of models) {
    // `model.modelName` va DENTRO del try: si algún elemento de `models`
    // llegara malformado (p. ej. un binding sin resolver por un ciclo de
    // imports en el barrel), acceder a `.modelName` fuera del try tiraría
    // sin capturar, abortando el loop entero — justo lo que este bloque
    // existe para evitar (un modelo roto no debe ocultar fallos en el resto).
    let modelName = "(modelo desconocido)";

    try {
      modelName = model.modelName;
      await model.createIndexes();
      logger.info({ model: modelName }, "Índices creados/confirmados");
    } catch (error) {
      hadFailure = true;
      logger.error({ model: modelName, err: error }, "Fallo creando índices");
      // Seguir con el resto de modelos: un solo modelo con un índice en
      // conflicto (p. ej. mismo nombre, opciones distintas) no debe ocultar
      // fallos en los demás — el resultado final igual marca el fallo.
      continue;
    }

    try {
      const diff = await model.diffIndexes();
      if (diff.toDrop.length > 0) {
        logger.warn(
          { model: modelName, toDrop: diff.toDrop },
          options.prune
            ? "Borrando índices sobrantes (--prune)"
            : "Índices sobrantes detectados — no se borran sin --prune",
        );
        if (options.prune) {
          await model.cleanIndexes({ toDrop: diff.toDrop });
        }
      }
    } catch (error) {
      hadFailure = true;
      logger.error(
        { model: modelName, err: error },
        "Fallo calculando o borrando el diff de índices",
      );
    }
  }

  return { hadFailure };
}

/** Entrypoint de CLI: `node dist/scripts/sync-indexes.js [--prune]`. */
async function main(): Promise<void> {
  const prune = process.argv.includes(PRUNE_FLAG);

  await connectDatabase();
  let hadFailure: boolean;
  try {
    ({ hadFailure } = await syncIndexes({ prune }));
  } finally {
    // Mismo criterio que seed-admin.ts: si syncIndexes() lanzara (hoy no
    // debería, cada modelo tiene su propio try/catch, pero un fallo
    // inesperado fuera del loop no debe dejar la conexión abierta).
    await disconnectDatabase();
  }

  if (hadFailure) {
    throw new Error("Sync de índices terminó con errores — ver el log de arriba.");
  }
}

// Solo se auto-ejecuta corrido directamente (CLI/pre-deploy) — importarlo
// desde un test no debe conectar/desconectar la BD ni llamar process.exit().
// `pathToFileURL` (no una plantilla `file://${...}` a mano): con cualquier
// symlink en la ruta (bind mounts, `railway ssh` aterrizando en un home
// symlinkeado), `import.meta.url` resuelve la ruta real mientras
// `process.argv[1]` queda literal — la comparación de strings nunca
// coincide y el script hace no-op en silencio, sin log ni error.
const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .then(() => {
      logger.info("Sync de índices completado");
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Fallo el sync de índices");
      process.exit(1);
    });
}

export { syncIndexes };
