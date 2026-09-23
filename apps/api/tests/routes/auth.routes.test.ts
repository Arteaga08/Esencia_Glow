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

/**
 * Lleva a un admin sin 2FA hasta tener 2FA activo y sesión, pasando por el
 * flujo pre-auth de enrolamiento obligatorio (login -> setup -> enroll) —
 * el único camino que existe ahora que un admin sin 2FA nunca recibe sesión
 * directa de `/login`. Devuelve el secreto en claro para que el test pueda
 * generar más códigos TOTP después.
 */
async function bootstrapAdminWithTwoFactor(email: string, password: string) {
  const agent = request.agent(app);
  const loginResponse = await agent.post("/api/v1/auth/login").send({ email, password });
  expect(loginResponse.body.data.next).toBe("twoFactorSetup");

  const setupResponse = await agent.post("/api/v1/auth/login/2fa/setup");
  expect(setupResponse.status).toBe(200);
  const { manualEntryKey } = setupResponse.body.data as { manualEntryKey: string };

  const enrollResponse = await agent
    .post("/api/v1/auth/login/2fa/enroll")
    .send({ code: authenticator.generate(manualEntryKey) });
  expect(enrollResponse.status).toBe(200);

  return { agent, secret: manualEntryKey };
}

describe("routes/auth — enrolamiento obligatorio de 2FA para admin sin 2FA", () => {
  beforeEach(() => {
    vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
  });

  it("login de un admin sin 2FA no deja cookies de sesión, solo el pending token de enrolamiento", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const agent = request.agent(app);
    const loginResponse = await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data).toEqual({ next: "twoFactorSetup" });

    const meResponse = await agent.get("/api/v1/auth/me");
    expect(meResponse.status).toBe(401);
  });

  it("setup es idempotente: recargar la pantalla de enrolamiento no invalida el QR ya escaneado", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    const first = await agent.post("/api/v1/auth/login/2fa/setup");
    const second = await agent.post("/api/v1/auth/login/2fa/setup");

    expect(first.body.data.manualEntryKey).toBe(second.body.data.manualEntryKey);
  });

  it("enroll con código inválido no activa 2FA ni dificulta reintentar", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });
    const setup = await agent.post("/api/v1/auth/login/2fa/setup");
    const { manualEntryKey } = setup.body.data as { manualEntryKey: string };

    const wrongCode = await agent.post("/api/v1/auth/login/2fa/enroll").send({ code: "000000" });
    expect(wrongCode.status).toBe(401);

    const untouched = await User.findById(userId);
    expect(untouched?.twoFactor.enabled).toBe(false);

    const validCode = await agent
      .post("/api/v1/auth/login/2fa/enroll")
      .send({ code: authenticator.generate(manualEntryKey) });
    expect(validCode.status).toBe(200);
  });

  /**
   * El test que justifica tener un `purpose` de token separado para el
   * enrolamiento (jwt.ts): el pending token que deja un login normal con 2FA
   * YA activo no debe servir para llamar al setup de enrolamiento — si lo
   * hiciera, cualquiera con la contraseña de un admin ya protegido podría
   * reemplazar su secreto de 2FA por uno propio.
   */
  it("el pending token de un login con 2FA ya activo NO sirve en /login/2fa/setup (regresión del bypass)", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });
    const { secret: originalSecret } = await bootstrapAdminWithTwoFactor(email, "Contrasena1");

    const beforeAttack = await User.findById(userId).select("+twoFactor.secret");

    // Nuevo login: como el admin ya tiene 2FA, esto deja el pending token
    // "pending_2fa" (login-2FA), no el de enrolamiento.
    const attackerAgent = request.agent(app);
    const loginResponse = await attackerAgent
      .post("/api/v1/auth/login")
      .send({ email, password: "Contrasena1" });
    expect(loginResponse.body.data.next).toBe("twoFactor");

    const setupAttempt = await attackerAgent.post("/api/v1/auth/login/2fa/setup");
    expect(setupAttempt.status).toBe(401);

    const afterAttack = await User.findById(userId).select("+twoFactor.secret");
    expect(afterAttack?.twoFactor.secret).toBe(beforeAttack?.twoFactor.secret);
    expect(afterAttack?.twoFactor.enabled).toBe(true);

    // El dueño real de la cuenta sigue pudiendo loguearse con su código.
    const validLogin = await attackerAgent
      .post("/api/v1/auth/login/2fa")
      .send({ code: authenticator.generate(originalSecret) });
    expect(validLogin.status).toBe(200);
  });

  it("happy path completo: login -> setup -> enroll deja sesión, 2FA activo, y el próximo login pide solo el código", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const { agent } = await bootstrapAdminWithTwoFactor(email, "Contrasena1");

    const meResponse = await agent.get("/api/v1/auth/me");
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.role).toBe("admin");

    const reloaded = await User.findById(userId);
    expect(reloaded?.twoFactor.enabled).toBe(true);

    const secondAgent = request.agent(app);
    const nextLogin = await secondAgent
      .post("/api/v1/auth/login")
      .send({ email, password: "Contrasena1" });
    expect(nextLogin.body.data.next).toBe("twoFactor");
  });
});

describe("routes/auth — 2FA de dos pasos para admin (ya enrolado)", () => {
  beforeEach(() => {
    vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
  });

  it("login con 2FA activo exige el segundo paso antes de emitir sesión", async () => {
    const { email, userId } = await registerAndVerify();
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });
    const { secret } = await bootstrapAdminWithTwoFactor(email, "Contrasena1");

    // Nuevo login: ahora debe pedir el segundo paso.
    const secondAgent = request.agent(app);
    const loginResponse = await secondAgent
      .post("/api/v1/auth/login")
      .send({ email, password: "Contrasena1" });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.next).toBe("twoFactor");

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
    const { agent, secret: originalSecret } = await bootstrapAdminWithTwoFactor(email, "Contrasena1");

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

describe("routes/auth — un admin sin 2FA nunca conserva sesión", () => {
  beforeEach(() => {
    vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
  });

  /**
   * Red de seguridad independiente del cambio en `login()`: aunque algo
   * emitiera cookies de sesión para un admin sin 2FA, `protect` y `refresh`
   * las rechazan igual. Se prueba forzando el estado directo en BD (en vez
   * de depender del login) para que este test no se vuelva un no-op el día
   * que `login()` cambie.
   */
  it("protect rechaza un access token de admin sin 2FA aunque sea válido", async () => {
    const { email, userId } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const response = await agent.get("/api/v1/auth/me");
    expect(response.status).toBe(401);
  });

  it("refresh rechaza a un admin sin 2FA aunque el refresh token sea válido", async () => {
    const { email, userId } = await registerAndVerify();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email, password: "Contrasena1" });
    await User.updateOne({ _id: userId }, { $set: { role: "admin" } });

    const response = await agent.post("/api/v1/auth/refresh");
    expect(response.status).toBe(401);
  });
});
