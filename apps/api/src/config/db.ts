import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Conecta a MongoDB con retry/backoff exponencial. Un fallo transitorio de la
 * DB al arrancar no debe matar el proceso en silencio — reintenta antes de
 * rendirse.
 */
async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  // autoIndex se apaga en producción: syncIndexes() corre como paso de CD,
  // no en cada arranque del server.
  mongoose.set("autoIndex", !env.isProduction);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(env.mongodbUri);
      logger.info({ attempt }, "Conexión a MongoDB establecida");
      return;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      logger.error({ attempt, error }, "Fallo al conectar a MongoDB");
      if (isLastAttempt) throw error;
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
}

async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info("Conexión a MongoDB cerrada");
}

export { connectDatabase, disconnectDatabase };
