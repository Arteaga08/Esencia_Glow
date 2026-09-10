import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";
import { models } from "../src/models/index.js";

/**
 * Mongo real en memoria (no mocks del ODM) compartido por toda la suite.
 * Las variables requeridas por config/env.ts se fijan antes de cualquier
 * import de código de la app, para que loadEnv() no explote en tests.
 *
 * Replica set (no standalone): el inventario (1.4) usa `session.withTransaction`
 * para reservar/comprometer stock, y las transacciones de Mongo solo funcionan
 * sobre un replica set. `replSet: { count: 1 }` ya es el default de
 * mongodb-memory-server — un solo nodo basta para ejercitar transacciones y
 * WriteConflicts reales (no reproduce failover ni latencia de red, pero eso
 * no es lo que esta suite necesita probar).
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-de-al-menos-48-caracteres-000000";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-de-al-menos-48-caracteres-0000";
process.env.ENCRYPTION_KEY = "test-encryption-key-de-32-caracteres";
process.env.CLIENT_URL = "http://localhost:3000";
// Placeholder síncrono para que loadEnv() no falle al importarse: buildApp()
// nunca conecta la DB por sí sola, solo lo hace este setup vía mongoose.connect
// directo con la URI real del servidor en memoria (asignada abajo).
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/esencia_glow_test_placeholder";

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create();
  await mongoose.connect(mongoServer.getUri("esencia_glow_test"));
  // Fuerza la creación de colecciones + índices ANTES de cualquier test: crear
  // una colección o construir un índice dentro de una transacción no está
  // permitido, y Mongoose los crea de forma perezosa en el primer uso.
  await Promise.all(models.map((registeredModel) => registeredModel.init()));
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
