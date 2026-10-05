import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as RateLimitModule from "../../src/middlewares/rate-limit.js";

/**
 * Límites del flujo de cuentas (Milestone 3.5). `createRateLimiter` es no-op
 * fuera de producción, así que se importa con `NODE_ENV=production` real
 * (mismo truco de `rate-limit.test.ts`).
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

afterEach(() => {
  vi.resetModules();
});

describe("límite por correo (acciones que mandan un email)", () => {
  it("cuenta por el correo del body, sin importar la IP, y normaliza mayúsculas y espacios", async () => {
    const { emailActionRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.use(express.json());
    app.post("/x", emailActionRateLimiter, (_req, res) => res.sendStatus(200));

    const variants = ["Ana@Example.com", " ana@example.com ", "ANA@EXAMPLE.COM"];
    for (const email of variants) {
      expect((await request(app).post("/x").send({ email })).status).toBe(200);
    }
    expect((await request(app).post("/x").send({ email: "ana@example.com" })).status).toBe(429);
    // Otro correo no se ve afectado.
    expect((await request(app).post("/x").send({ email: "otra@example.com" })).status).toBe(200);
  });
});

describe("límite de login por cuenta", () => {
  it("solo cuenta los intentos fallidos: entrar bien no gasta la cuota", async () => {
    const { loginAccountRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.use(express.json());
    app.post("/login", loginAccountRateLimiter, (req, res) => res.sendStatus(req.body.password === "ok" ? 200 : 401));

    for (let i = 0; i < 8; i += 1) {
      expect((await request(app).post("/login").send({ email: "ana@example.com", password: "ok" })).status).toBe(200);
    }
    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).post("/login").send({ email: "ana@example.com", password: "mal" })).status).toBe(401);
    }
    expect((await request(app).post("/login").send({ email: "ana@example.com", password: "mal" })).status).toBe(429);
  });
});

describe("límite de cambio de contraseña", () => {
  it("cuenta por usuario autenticado", async () => {
    const { passwordChangeRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: String(req.headers["x-user"]), role: "customer" } as never;
      next();
    });
    app.patch("/password", passwordChangeRateLimiter, (_req, res) => res.sendStatus(200));

    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).patch("/password").set("x-user", "u1")).status).toBe(200);
    }
    expect((await request(app).patch("/password").set("x-user", "u1")).status).toBe(429);
    expect((await request(app).patch("/password").set("x-user", "u2")).status).toBe(200);
  });
});
