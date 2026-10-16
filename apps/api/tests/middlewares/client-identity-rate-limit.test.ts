import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importRateLimitInProduction, TEST_INTERNAL_TOKEN } from "../helpers/import-rate-limit.js";
import { closeServedApps, serveApp } from "../helpers/serve-app.js";

/**
 * Identidad del cliente en los limiters IP (auditoría run-2, hallazgos 1 y 3):
 * IPv6 agrupada por /56 y IP del visitante prestada por el servidor web.
 */
afterEach(() => {
  vi.resetModules();
  closeServedApps();
});

/** Hexteto distinto por intento dentro del MISMO /56 (2001:db8:abcd:12xx::). */
function sameSlash56(i: number): string {
  return `2001:db8:abcd:12${i.toString(16).padStart(2, "0")}::${i + 1}`;
}

describe("limiters por IP — IPv6", () => {
  it("rotar la dirección dentro de un mismo /56 no da cubeta nueva", async () => {
    const { loginRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.set("trust proxy", 1);
    app.post("/login", loginRateLimiter, (_req, res) => res.sendStatus(401));
    const api = await serveApp(app);

    for (let i = 0; i < 10; i += 1) {
      expect((await api.post("/login").set("x-forwarded-for", sameSlash56(i))).status).toBe(401);
    }
    expect((await api.post("/login").set("x-forwarded-for", sameSlash56(11))).status).toBe(429);
  });

  it("IPv4 distintas siguen teniendo cubetas distintas", async () => {
    const { loginRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.set("trust proxy", 1);
    app.post("/login", loginRateLimiter, (_req, res) => res.sendStatus(401));
    const api = await serveApp(app);

    for (let i = 0; i < 10; i += 1) {
      await api.post("/login").set("x-forwarded-for", "198.51.100.1");
    }
    expect((await api.post("/login").set("x-forwarded-for", "198.51.100.1")).status).toBe(429);
    expect((await api.post("/login").set("x-forwarded-for", "198.51.100.2")).status).toBe(401);
  });
});

describe("limiters por IP — visitante prestado por el servidor web", () => {
  it("con token, cada visitante reenviado tiene su propia cubeta aunque req.ip sea el mismo", async () => {
    const { checkoutRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.post("/x", checkoutRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);
    const asVisitor = (ip: string) =>
      api.post("/x").set("x-internal-token", TEST_INTERNAL_TOKEN).set("x-client-ip", ip);

    for (let i = 0; i < 10; i += 1) {
      expect((await asVisitor("198.51.100.1")).status).toBe(200);
    }
    expect((await asVisitor("198.51.100.1")).status).toBe(429);
    expect((await asVisitor("198.51.100.2")).status).toBe(200);
  });

  it("sin token, x-client-ip se ignora: un cliente no puede elegir su cubeta", async () => {
    const { checkoutRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.post("/x", checkoutRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);

    for (let i = 0; i < 10; i += 1) {
      expect((await api.post("/x").set("x-client-ip", `198.51.100.${i + 1}`)).status).toBe(200);
    }
    expect((await api.post("/x").set("x-client-ip", "198.51.100.99")).status).toBe(429);
  });

  it("con token falso tampoco se confía en x-client-ip", async () => {
    const { checkoutRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.post("/x", checkoutRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);
    const forged = (ip: string) =>
      api.post("/x").set("x-internal-token", "x".repeat(40)).set("x-client-ip", ip);

    for (let i = 0; i < 10; i += 1) await forged(`198.51.100.${i + 1}`);
    expect((await forged("198.51.100.99")).status).toBe(429);
  });
});

describe("limiters global y de catálogo — petición del servidor web sin visitante", () => {
  it("no gasta la cuota de los visitantes: cuenta en su propia cubeta, bastante más holgada", async () => {
    const { globalRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.get("/g", globalRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);

    // 305 del servidor web (más que los 300 de un visitante) siguen pasando...
    for (let i = 0; i < 305; i += 1) {
      expect((await api.get("/g").set("x-internal-token", TEST_INTERNAL_TOKEN)).status).toBe(200);
    }
    // ...y un visitante sin token conserva su cuota completa.
    expect((await api.get("/g")).status).toBe(200);
  }, 120_000);

  it("pero la cubeta del servidor web también tiene techo (no es un pase libre)", async () => {
    const { globalRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.get("/g", globalRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);

    let blockedAt = -1;
    for (let i = 0; i < 3_100 && blockedAt < 0; i += 1) {
      const res = await api.get("/g").set("x-internal-token", TEST_INTERNAL_TOKEN);
      if (res.status === 429) blockedAt = i;
    }
    expect(blockedAt).toBe(3_000);
    // Y agotarla no toca a un visitante reenviado.
    expect(
      (await api.get("/g").set("x-internal-token", TEST_INTERNAL_TOKEN).set("x-client-ip", "198.51.100.1")).status,
    ).toBe(200);
  }, 240_000);

  it("el límite global sigue aplicando a quien no manda token", async () => {
    const { globalRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.get("/g", globalRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);

    for (let i = 0; i < 300; i += 1) await api.get("/g");
    expect((await api.get("/g")).status).toBe(429);
  }, 120_000);

  it("un visitante reenviado agotado no tumba a otro", async () => {
    const { globalRateLimiter } = await importRateLimitInProduction();
    const app = express();
    app.get("/g", globalRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);
    const asVisitor = (ip: string) =>
      api.get("/g").set("x-internal-token", TEST_INTERNAL_TOKEN).set("x-client-ip", ip);

    for (let i = 0; i < 300; i += 1) await asVisitor("198.51.100.1");
    expect((await asVisitor("198.51.100.1")).status).toBe(429);
    expect((await asVisitor("198.51.100.2")).status).toBe(200);
  }, 120_000);
});
