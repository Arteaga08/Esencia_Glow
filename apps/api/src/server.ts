import type { Server } from "node:http";
import { buildApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { flushSentry, initSentry } from "./config/sentry.js";
import { startCronJobs, stopCronJobs } from "./jobs/index.js";

async function start(): Promise<void> {
  // Antes de conectar a Mongo: un fallo de arranque también debe reportarse.
  initSentry();
  await connectDatabase();

  const app = buildApp();
  const server: Server = app.listen(env.port, () => {
    logger.info({ port: env.port, nodeEnv: env.nodeEnv }, "API de Esencia Glow escuchando");
  });

  // Después de escuchar: el barrendero de reservas vencidas depende de la
  // conexión a Mongo, no del puerto HTTP, pero arrancarlo aquí mantiene el
  // orden de arranque legible (DB -> HTTP -> jobs de fondo).
  startCronJobs();

  // Railway puede reenviar SIGTERM si el primero no cerró a tiempo — sin
  // esta guarda, la segunda señal dispara un shutdown concurrente que
  // vuelve a llamar disconnectDatabase()/process.exit() sobre un proceso
  // que ya está a medio cerrar.
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "Apagando servidor de forma ordenada");
    await stopCronJobs();
    // No esperar los keep-alive de Cloudflare hasta el timeout de 10s de
    // abajo: cierra ya las conexiones que no están a mitad de un request.
    server.closeIdleConnections();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Red de seguridad: si el cierre ordenado se cuelga, forzar salida.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // El `logger.error` ya manda el evento a Sentry; hay que vaciar su cola
  // antes de `process.exit`, o el error fatal se pierde justo cuando importa.
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
    void flushSentry().finally(() => process.exit(1));
  });

  process.on("uncaughtException", (error) => {
    logger.error({ err: error }, "Uncaught exception");
    void flushSentry().finally(() => process.exit(1));
  });
}

start().catch((error: unknown) => {
  logger.error({ err: error }, "Fallo fatal al arrancar el servidor");
  void flushSentry().finally(() => process.exit(1));
});
