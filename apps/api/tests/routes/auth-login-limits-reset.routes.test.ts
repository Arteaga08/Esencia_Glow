import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import type * as RateLimitModule from "../../src/middlewares/rate-limit.js";
import { resetLoginLimits } from "../../src/middlewares/rate-limit.js";
import { User } from "../../src/models/user.model.js";
import { VerificationToken } from "../../src/models/verification-token.model.js";
import { hashToken } from "../../src/utils/crypto.js";
import * as emailService from "../../src/services/email.service.js";
import { __setPasswordBreachCheckerForTests } from "../../src/services/password-breach.service.js";
import { serveAppForFile } from "../helpers/serve-app.js";

// Los limiters son no-op fuera de producción: lo que se verifica aquí es que los
// controllers LIBERAN las cubetas de login (el comportamiento del limiter ya lo
// cubre tests/middlewares/auth-rate-limit.test.ts).
vi.mock("../../src/middlewares/rate-limit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof RateLimitModule>();
  return { ...actual, resetLoginLimits: vi.fn() };
});

const app = await serveAppForFile(buildApp());

async function createVerifiedUser() {
  const email = `reset-${Date.now()}-${Math.random()}@example.com`;
  const user = await User.create({
    email,
    password: "Contrasena1",
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: true,
  });
  return { email, user };
}

beforeEach(() => {
  vi.mocked(resetLoginLimits).mockClear();
  vi.spyOn(emailService, "sendPasswordChangedNotice").mockResolvedValue(undefined);
  __setPasswordBreachCheckerForTests(async () => false);
});

describe("routes/auth — liberar el límite de login al recuperar la cuenta", () => {
  it("POST /reset-password correcto libera los límites del correo de la cuenta", async () => {
    const { email, user } = await createVerifiedUser();
    const raw = "reset-raw-token";
    await VerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(raw),
      type: "password_reset",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await request(app).post("/api/v1/auth/reset-password").send({ token: raw, password: "OtraContrasena9" });

    expect(response.status).toBe(200);
    expect(resetLoginLimits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resetLoginLimits).mock.calls[0]?.[0]).toBe(email);
  });

  it("POST /reset-password con token inválido no libera nada", async () => {
    const response = await request(app).post("/api/v1/auth/reset-password").send({ token: "no-existe", password: "OtraContrasena9" });

    expect(response.status).toBe(400);
    expect(resetLoginLimits).not.toHaveBeenCalled();
  });

  it("PATCH /password correcto libera los límites del correo de la cuenta", async () => {
    const { email } = await createVerifiedUser();
    const agent = request.agent(app);
    // Un customer verificado sin 2FA entra directo.
    expect((await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" })).status).toBe(200);

    const response = await agent.patch("/api/v1/auth/password").send({
      currentPassword: "Contrasena1",
      newPassword: "NuevaContrasena1",
    });

    expect(response.status).toBe(200);
    expect(resetLoginLimits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resetLoginLimits).mock.calls[0]?.[0]).toBe(email);
  });

  it("PATCH /password con la contraseña actual incorrecta no libera nada", async () => {
    const { email } = await createVerifiedUser();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const response = await agent.patch("/api/v1/auth/password").send({
      currentPassword: "Equivocada1",
      newPassword: "NuevaContrasena1",
    });

    expect(response.status).toBe(401);
    expect(resetLoginLimits).not.toHaveBeenCalled();
  });
});

describe("routes/auth — registrarse de nuevo sobre una cuenta sin verificar", () => {
  it("dentro del enfriamiento no manda un segundo correo de verificación", async () => {
    const send = vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
    const body = { email: `repetido-${Date.now()}@example.com`, password: "Contrasena1", firstName: "Ana", lastName: "Pérez" };

    expect((await request(app).post("/api/v1/auth/register").send(body)).status).toBe(201);
    expect((await request(app).post("/api/v1/auth/register").send(body)).status).toBe(201);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
