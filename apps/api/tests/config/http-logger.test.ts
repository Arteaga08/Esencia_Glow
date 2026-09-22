import { Writable } from "node:stream";
import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { redact } from "../../src/config/logger.js";
import { buildHttpLogger } from "../../src/config/http-logger.js";

/**
 * `config/http-logger.ts` reusa el `logger` singleton de `config/logger.ts`
 * para heredar su `redact` — probar eso mismo contra el singleton no es
 * viable: un logger hijo de pino-http comparte el destino físico de su
 * padre (stdout vía sonic-boom, que escribe directo sobre el file
 * descriptor, sin pasar por `process.stdout.write`), así que no hay forma
 * de interceptar esa salida desde un test. En su lugar se usa
 * `buildHttpLogger` con un logger propio que reusa las mismas reglas de
 * `redact` (exportadas por `config/logger.ts`, no copiadas a mano) apuntando
 * a un stream en memoria — mismo comportamiento de redacción, destino
 * capturable de forma síncrona.
 */
function buildCapturingApp(): { app: express.Express; lines: () => unknown[] } {
  const chunks: string[] = [];
  const captureStream = new Writable({
    write(chunk, _enc, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  const testLogger = pino({ redact }, captureStream);
  const httpLogger = buildHttpLogger(testLogger);

  const app = express();
  app.use(httpLogger);
  app.get("/api/v1/health", (_req, res) => res.status(200).json({ status: "success" }));
  app.get("/api/v1/ruta-inexistente", (_req, res) => res.status(404).json({ status: "fail" }));

  return {
    app,
    lines: () => chunks.map((chunk) => JSON.parse(chunk) as Record<string, unknown>),
  };
}

describe("config/http-logger — redacción", () => {
  it("no deja cookie ni Authorization en claro en el log de requests", async () => {
    const { app, lines } = buildCapturingApp();

    await request(app)
      .get("/api/v1/ruta-inexistente")
      .set("Cookie", "sessionId=super-secreto-de-sesion")
      .set("Authorization", "Bearer super-secreto-de-token");

    const requestLine = lines().find((line) => "req" in line) as
      | { req: { headers: Record<string, string> } }
      | undefined;
    expect(requestLine).toBeDefined();
    expect(requestLine?.req.headers.cookie).toBe("[redacted]");
    expect(requestLine?.req.headers.authorization).toBe("[redacted]");
    expect(JSON.stringify(requestLine)).not.toContain("super-secreto");
  });

  it("no loguea las rutas de /health (ruido de healthcheck de Railway)", async () => {
    const { app, lines } = buildCapturingApp();

    await request(app).get("/api/v1/health");

    expect(lines().find((line) => "req" in line)).toBeUndefined();
  });
});
