import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importRateLimitInProduction } from "../helpers/import-rate-limit.js";
import { closeServedApps, serveApp } from "../helpers/serve-app.js";

/**
 * Límites del flujo de cuentas (Milestone 3.5 + auditoría run-2, hallazgos 10 y
 * 11). `createRateLimiter` es no-op fuera de producción, así que se importa con
 * `NODE_ENV=production` real (helper compartido).
 */
afterEach(() => {
  vi.resetModules();
  closeServedApps();
});

/** App con `trust proxy` para que cada petición pueda simular su IP con `x-forwarded-for`. */
function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  return app;
}

describe("límite por correo (acciones que mandan un email)", () => {
  it("cuenta por correo + IP y normaliza mayúsculas y espacios", async () => {
    const { forgotPasswordEmailRateLimiter } = await importRateLimitInProduction();
    const app = buildApp();
    app.post("/x", forgotPasswordEmailRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);
    const post = (email: string, ip = "198.51.100.1") => api.post("/x").set("x-forwarded-for", ip).send({ email });

    for (const email of ["Ana@Example.com", " ana@example.com ", "ANA@EXAMPLE.COM"]) {
      expect((await post(email)).status).toBe(200);
    }
    expect((await post("ana@example.com")).status).toBe(429);
    // Otro correo, desde la misma IP, no se ve afectado.
    expect((await post("otra@example.com")).status).toBe(200);
  });

  it("quien agota su cubeta desde una IP no bloquea al dueño del correo desde otra IP", async () => {
    const { forgotPasswordEmailRateLimiter } = await importRateLimitInProduction();
    const app = buildApp();
    app.post("/x", forgotPasswordEmailRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);
    const post = (ip: string) => api.post("/x").set("x-forwarded-for", ip).send({ email: "ana@example.com" });

    for (let i = 0; i < 3; i += 1) expect((await post("198.51.100.1")).status).toBe(200);
    expect((await post("198.51.100.1")).status).toBe(429);
    expect((await post("203.0.113.50")).status).toBe(200);
  });

  it("registro, reenviar verificación y olvidé mi contraseña tienen cubetas separadas", async () => {
    const { registerEmailRateLimiter, resendVerificationEmailRateLimiter, forgotPasswordEmailRateLimiter } =
      await importRateLimitInProduction();
    const app = buildApp();
    app.post("/register", registerEmailRateLimiter, (_req, res) => res.sendStatus(200));
    app.post("/resend", resendVerificationEmailRateLimiter, (_req, res) => res.sendStatus(200));
    app.post("/forgot", forgotPasswordEmailRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);
    const post = (path: string) => api.post(path).set("x-forwarded-for", "198.51.100.1").send({ email: "ana@example.com" });

    for (let i = 0; i < 3; i += 1) await post("/register");
    expect((await post("/register")).status).toBe(429);
    // Agotar el registro no deja sin recuperación de contraseña a esa dueña.
    expect((await post("/forgot")).status).toBe(200);
    expect((await post("/resend")).status).toBe(200);
  });

  it("un correo rellenado con espacios (más de 254 caracteres crudos) cuenta en la misma cubeta, no cae a la IP", async () => {
    const { forgotPasswordEmailRateLimiter } = await importRateLimitInProduction();
    const app = buildApp();
    app.post("/x", forgotPasswordEmailRateLimiter, (_req, res) => res.sendStatus(200));
    const api = await serveApp(app);
    const post = (email: string) => api.post("/x").set("x-forwarded-for", "198.51.100.1").send({ email });

    const padded = `${" ".repeat(300)}ana@example.com`;
    for (let i = 0; i < 3; i += 1) expect((await post(padded)).status).toBe(200);
    expect((await post("ana@example.com")).status).toBe(429);
  });
});

describe("límite de login por cuenta", () => {
  it("solo cuenta los intentos fallidos: entrar bien no gasta la cuota", async () => {
    const { loginAccountRateLimiter } = await importRateLimitInProduction();
    const app = buildApp();
    app.post("/login", loginAccountRateLimiter, (req, res) => res.sendStatus(req.body.password === "ok" ? 200 : 401));
    const api = await serveApp(app);
    const login = (password: string) =>
      api.post("/login").set("x-forwarded-for", "198.51.100.1").send({ email: "ana@example.com", password });

    for (let i = 0; i < 8; i += 1) expect((await login("ok")).status).toBe(200);
    for (let i = 0; i < 5; i += 1) expect((await login("mal")).status).toBe(401);
    expect((await login("mal")).status).toBe(429);
  });

  it("5 fallos de un atacante desde su IP no bloquean a la dueña desde otra IP", async () => {
    const { loginAccountRateLimiter } = await importRateLimitInProduction();
    const app = buildApp();
    app.post("/login", loginAccountRateLimiter, (req, res) => res.sendStatus(req.body.password === "ok" ? 200 : 401));
    const api = await serveApp(app);
    const login = (ip: string, password: string) =>
      api.post("/login").set("x-forwarded-for", ip).send({ email: "ana@example.com", password });

    for (let i = 0; i < 5; i += 1) await login("198.51.100.1", "mal");
    expect((await login("198.51.100.1", "mal")).status).toBe(429);
    expect((await login("203.0.113.50", "ok")).status).toBe(200);
  });

  it("el techo por correo frena el ataque distribuido (muchas IPs, una cuenta)", async () => {
    const { loginEmailCeilingRateLimiter } = await importRateLimitInProduction();
    const app = buildApp();
    app.post("/login", loginEmailCeilingRateLimiter, (req, res) => res.sendStatus(req.body.password === "ok" ? 200 : 401));
    const api = await serveApp(app);
    const login = (ip: string, password: string) =>
      api.post("/login").set("x-forwarded-for", ip).send({ email: "ana@example.com", password });

    for (let i = 0; i < 30; i += 1) expect((await login(`198.51.100.${i + 1}`, "mal")).status).toBe(401);
    expect((await login("203.0.113.77", "mal")).status).toBe(429);
    // Otra cuenta no se ve afectada.
    expect(
      (await api.post("/login").set("x-forwarded-for", "203.0.113.77").send({ email: "otra@example.com", password: "ok" })).status,
    ).toBe(200);
  });

  it("resetLoginLimits libera la cubeta correo+IP y el techo del correo", async () => {
    const { loginAccountRateLimiter, loginEmailCeilingRateLimiter, resetLoginLimits } = await importRateLimitInProduction();
    const app = buildApp();
    app.post(
      "/login",
      loginAccountRateLimiter,
      loginEmailCeilingRateLimiter,
      (req, res) => res.sendStatus(req.body.password === "ok" ? 200 : 401),
    );
    app.post("/reset", (req, res) => {
      resetLoginLimits(req.body.email, req);
      res.sendStatus(200);
    });
    const api = await serveApp(app);
    const login = () =>
      api.post("/login").set("x-forwarded-for", "198.51.100.1").send({ email: "ana@example.com", password: "mal" });

    for (let i = 0; i < 5; i += 1) await login();
    expect((await login()).status).toBe(429);

    await api.post("/reset").set("x-forwarded-for", "198.51.100.1").send({ email: " Ana@Example.com " });
    expect((await login()).status).toBe(401);
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
    const api = await serveApp(app);

    for (let i = 0; i < 5; i += 1) {
      expect((await api.patch("/password").set("x-user", "u1")).status).toBe(200);
    }
    expect((await api.patch("/password").set("x-user", "u1")).status).toBe(429);
    expect((await api.patch("/password").set("x-user", "u2")).status).toBe(200);
  });
});
