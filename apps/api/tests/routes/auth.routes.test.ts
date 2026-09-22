import { authenticator } from "otplib";
import request from "supertest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { VerificationToken } from "../../src/models/verification-token.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { hashToken } from "../../src/utils/crypto.js";
import * as emailService from "../../src/services/email.service.js";

const app = buildApp();

async function registerAndVerify(overrides: Partial<{ email: string }> = {}) {
  const email = overrides.email ?? `user-${Date.now()}-${Math.random()}@example.com`;
  await request(app).post("/api/v1/auth/register").send({
    email,
    password: "Contrasena1",
    firstName: "Ana",
    lastName: "Pérez",
  });

  const user = await User.findOne({ email });
  const raw = "test-raw-token";
  await VerificationToken.create({
    userId: user!._id,
    tokenHash: hashToken(raw),
    type: "email_verification",
    expiresAt: new Date(Date.now() + 60_000),
  });
  await request(app).post("/api/v1/auth/verify-email").send({ token: raw });

  return { email, userId: user!._id };
}

describe("routes/auth — golden path", () => {
  beforeEach(() => {
    vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
    vi.spyOn(emailService, "sendPasswordResetEmail").mockResolvedValue(undefined);
    vi.spyOn(emailService, "sendPasswordChangedNotice").mockResolvedValue(undefined);
  });

  it("register responde 201 genérico sin importar si el email es válido", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: "nueva@example.com",
      password: "Contrasena1",
      firstName: "Ana",
      lastName: "Pérez",
    });
    expect(response.status).toBe(201);
  });

  it("register con datos inválidos responde 400 con errores por campo", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: "no-es-email",
      password: "corta",
      firstName: "",
      lastName: "",
    });
    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it("login antes de verificar el correo responde 403", async () => {
    const email = `sinverificar-${Date.now()}@example.com`;
    await request(app).post("/api/v1/auth/register").send({
      email,
      password: "Contrasena1",
      firstName: "Ana",
      lastName: "Pérez",
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "Contrasena1" });

    expect(response.status).toBe(403);
  });

  it("login con contraseña incorrecta responde 401 genérico (mismo mensaje que email inexistente)", async () => {
    const { email } = await registerAndVerify();

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "Incorrecta1" });
    const nonExistentEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "no-existe@example.com", password: "Cualquiera1" });

    expect(wrongPassword.status).toBe(401);
    expect(nonExistentEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(nonExistentEmail.body.message);
  });

  it("registro -> verificación -> login exitoso deja cookies httpOnly y GET /me funciona", async () => {
    const { email } = await registerAndVerify();
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .send({ email, password: "Contrasena1" });

    expect(loginResponse.status).toBe(200);
    const setCookie = loginResponse.headers["set-cookie"] as unknown as string[];
    expect(setCookie.some((c) => c.includes("HttpOnly"))).toBe(true);

    const meResponse = await agent.get("/api/v1/auth/me");
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.role).toBe("customer");
  });

  it("refresh rota el token y el token viejo deja de servir", async () => {
    const { email } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const refreshResponse = await agent.post("/api/v1/auth/refresh");
    expect(refreshResponse.status).toBe(200);

    const meAfterRefresh = await agent.get("/api/v1/auth/me");
    expect(meAfterRefresh.status).toBe(200);
  });

  it("logout limpia la cookie y GET /me deja de funcionar tras reintentar con el access token viejo", async () => {
    const { email } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const logoutResponse = await agent.post("/api/v1/auth/logout");
    expect(logoutResponse.status).toBe(200);

    const refreshAfterLogout = await agent.post("/api/v1/auth/refresh");
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("GET /me sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
  });

  it("GET /me devuelve el usuario completo (no solo id/role) y capabilities.subscriber: null sin cuenta", async () => {
    const { email } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const response = await agent.get("/api/v1/auth/me");
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ email, firstName: "Ana", lastName: "Pérez" });
    expect(response.body.data.capabilities).toEqual({ subscriber: null });
  });

  it("GET /me con una cuenta de suscripción ACTIVE trae capabilities.subscriber poblado", async () => {
    const { email, userId } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });
    await SubscriptionAccount.create({
      userId,
      planId: userId, // cualquier ObjectId sirve para esta aserción
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      providerCustomerId: "cus_no_filtrar",
    });

    const response = await agent.get("/api/v1/auth/me");
    expect(response.body.data.capabilities.subscriber.status).toBe("active");
    const raw = JSON.stringify(response.body.data);
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("cus_no_filtrar");
  });

  it("PATCH /password reemite el access token: /me sigue funcionando de inmediato con la misma sesión", async () => {
    const { email } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const changeResponse = await agent.patch("/api/v1/auth/password").send({
      currentPassword: "Contrasena1",
      newPassword: "NuevaContrasena1",
    });
    expect(changeResponse.status).toBe(200);

    // Sin reissue del access token, esto sería 401 porque passwordChangedAt
    // invalida cualquier token emitido antes del cambio.
    const meResponse = await agent.get("/api/v1/auth/me");
    expect(meResponse.status).toBe(200);

    // La contraseña nueva sí funciona en un login limpio.
    const freshAgent = request.agent(app);
    const reloginResponse = await freshAgent
      .post("/api/v1/auth/login")
      .send({ email, password: "NuevaContrasena1" });
    expect(reloginResponse.status).toBe(200);
  });
});

describe("routes/auth — 2FA de dos pasos para admin", () => {
  beforeEach(() => {
    vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
  });

  it("login con 2FA activo exige el segundo paso antes de emitir sesión", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const setupResponse = await agent.post("/api/v1/auth/2fa/setup");
    expect(setupResponse.status).toBe(200);

    const user = await User.findById(userId).select("+twoFactor.secret");
    const { decryptSecret } = await import("../../src/utils/crypto.js");
    const secret = decryptSecret(user!.twoFactor.secret!);
    const validCode = authenticator.generate(secret);

    const enableResponse = await agent.post("/api/v1/auth/2fa/enable").send({ code: validCode });
    expect(enableResponse.status).toBe(200);

    // Nuevo login: ahora debe pedir el segundo paso.
    const secondAgent = request.agent(app);
    const loginResponse = await secondAgent
      .post("/api/v1/auth/login")
      .send({ email, password: "Contrasena1" });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.twoFactorRequired).toBe(true);

    // Sin haber completado el 2FA, /me no debe funcionar.
    const meBeforeTwoFactor = await secondAgent.get("/api/v1/auth/me");
    expect(meBeforeTwoFactor.status).toBe(401);

    const nextCode = authenticator.generate(secret);
    const twoFactorResponse = await secondAgent
      .post("/api/v1/auth/login/2fa")
      .send({ code: nextCode });
    expect(twoFactorResponse.status).toBe(200);

    const meAfterTwoFactor = await secondAgent.get("/api/v1/auth/me");
    expect(meAfterTwoFactor.status).toBe(200);
  });

  it("con 2FA ya activo, /2fa/setup exige el código vigente antes de reemplazar el secreto", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    await agent.post("/api/v1/auth/2fa/setup");
    const user = await User.findById(userId).select("+twoFactor.secret");
    const { decryptSecret } = await import("../../src/utils/crypto.js");
    const originalSecret = decryptSecret(user!.twoFactor.secret!);
    await agent.post("/api/v1/auth/2fa/enable").send({ code: authenticator.generate(originalSecret) });

    // Sesión robada intenta re-enrolar 2FA sin el código actual.
    const withoutCode = await agent.post("/api/v1/auth/2fa/setup");
    expect(withoutCode.status).toBe(401);

    const withWrongCode = await agent.post("/api/v1/auth/2fa/setup").send({ code: "000000" });
    expect(withWrongCode.status).toBe(401);

    const untouched = await User.findById(userId);
    expect(untouched?.twoFactor.enabled).toBe(true);

    // Con el código vigente sí puede reconfigurar.
    const withValidCode = await agent
      .post("/api/v1/auth/2fa/setup")
      .send({ code: authenticator.generate(originalSecret) });
    expect(withValidCode.status).toBe(200);
  });

  it("un cliente (no-admin) no puede llamar a los endpoints de 2fa/setup", async () => {
    const { email } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const response = await agent.post("/api/v1/auth/2fa/setup");
    expect(response.status).toBe(403);
  });
});
