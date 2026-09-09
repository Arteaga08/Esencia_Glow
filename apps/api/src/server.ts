import type { Server } from "node:http";
import { buildApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

async function start(): Promise<void> {
  await connectDatabase();

  const app = buildApp();
  const server: Server = app.listen(env.port, () => {
    logger.info({ port: env.port, nodeEnv: env.nodeEnv }, "API de Esencia Glow escuchando");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Apagando servidor de forma ordenada");
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Red de seguridad: si el cierre ordenado se cuelga, forzar salida.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    logger.error({ err: error }, "Uncaught exception");
    process.exit(1);
  });
}

start().catch((error: unknown) => {
  logger.error({ err: error }, "Fallo fatal al arrancar el servidor");
  process.exit(1);
});
