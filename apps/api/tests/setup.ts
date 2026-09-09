import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

/**
 * Mongo real en memoria (no mocks del ODM) compartido por toda la suite.
 * Las variables requeridas por config/env.ts se fijan antes de cualquier
 * import de código de la app, para que loadEnv() no explote en tests.
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

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri("esencia_glow_test"));
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
