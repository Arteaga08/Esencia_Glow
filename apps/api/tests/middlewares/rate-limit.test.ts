import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as RateLimitModule from "../../src/middlewares/rate-limit.js";

/**
 * `createRateLimiter` es no-op fuera de producción (ver el propio archivo) —
 * para probar el `skip` de verdad hace falta `NODE_ENV=production` real,
 * mismo truco de `vi.resetModules` + import dinámico que usa
 * `tests/config/env.test.ts` (evita el hoisting: un import estático de
 * `rate-limit.js` evaluaría `env.js` ANTES de fijar `NODE_ENV` aquí).
 */
async function importRateLimitInProduction(): Promise<typeof RateLimitModule> {
  vi.resetModules();
  const previous: Record<string, string | undefined> = {};
  const overrides: Record<string, string> = {
    NODE_ENV: "production",
    CLIENT_URL: "https://www.esenciaglow.com",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    RESEND_API_KEY: "re_x",
    TRUST_PROXY_HOPS: "0",
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
  };
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    return await import("../../src/middlewares/rate-limit.js");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  }
}

describe("middlewares/rate-limit — skip de healthcheck", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("un path exento nunca cuenta contra la cuota, aunque se pase el max", async () => {
    const { createRateLimiter } = await importRateLimitInProduction();
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      message: "límite",
      skip: (req) => req.path.startsWith("/api/v1/health"),
    });

    const app = express();
    app.use(limiter);
    app.get("/api/v1/health", (_req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 5; i += 1) {
      const response = await request(app).get("/api/v1/health");
      expect(response.status).toBe(200);
    }
  });

  it("un path NO exento sí se limita al pasar el max (confirma que el limiter está activo)", async () => {
    const { createRateLimiter } = await importRateLimitInProduction();
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      message: "límite",
      skip: (req) => req.path.startsWith("/api/v1/health"),
    });

    const app = express();
    app.use(limiter);
    app.get("/api/v1/otra-ruta", (_req, res) => res.status(200).json({ ok: true }));

    await request(app).get("/api/v1/otra-ruta");
    await request(app).get("/api/v1/otra-ruta");
    const third = await request(app).get("/api/v1/otra-ruta");

    expect(third.status).toBe(429);
  });
});
