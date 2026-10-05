import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { VerificationToken } from "../../src/models/verification-token.model.js";
import { hashToken } from "../../src/utils/crypto.js";
import * as emailService from "../../src/services/email.service.js";
import { __setPasswordBreachCheckerForTests } from "../../src/services/password-breach.service.js";

const app = buildApp();

const BASE = { email: "ana@example.com", firstName: "Ana", lastName: "Pérez" };

beforeEach(() => {
  vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
  __setPasswordBreachCheckerForTests(async () => false);
});

describe("routes/auth — validación de entrada endurecida", () => {
  it("rechaza una contraseña de más de 72 bytes (bcrypt trunca en silencio más allá)", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...BASE, password: `Aa1${"x".repeat(70)}` });
    expect(response.status).toBe(400);
  });

  it("acepta una contraseña de exactamente 72 bytes", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...BASE, password: `Aa1${"x".repeat(69)}` });
    expect(response.status).toBe(201);
  });

  it("cuenta bytes, no caracteres: 40 emojis de 4 bytes pasan de 72", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...BASE, password: `Aa1${"😀".repeat(20)}` });
    expect(response.status).toBe(400);
  });

  it("rechaza un correo de más de 254 caracteres", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...BASE, email: `${"a".repeat(250)}@example.com`, password: "Contrasena1" });
    expect(response.status).toBe(400);
  });

  it("rechaza nombres de un solo carácter o de más de 60", async () => {
    const short = await request(app).post("/api/v1/auth/register").send({ ...BASE, firstName: "A", password: "Contrasena1" });
    const long = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...BASE, lastName: "P".repeat(61), password: "Contrasena1" });
    expect(short.status).toBe(400);
    expect(long.status).toBe(400);
  });

  it("una contraseña filtrada responde 400 con un mensaje claro", async () => {
    __setPasswordBreachCheckerForTests(async () => true);
    const response = await request(app).post("/api/v1/auth/register").send({ ...BASE, password: "Contrasena1" });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/filtraciones/i);
  });
});

describe("routes/auth — POST /verify-email pide la contraseña", () => {
  async function registerAndGetToken() {
    await request(app).post("/api/v1/auth/register").send({ ...BASE, password: "Contrasena1" });
    const user = await User.findOne({ email: BASE.email });
    await VerificationToken.create({
      userId: user!._id,
      tokenHash: hashToken("tok"),
      type: "email_verification",
      expiresAt: new Date(Date.now() + 60_000),
    });
    return user!;
  }

  it("sin password responde 400", async () => {
    await registerAndGetToken();
    const response = await request(app).post("/api/v1/auth/verify-email").send({ token: "tok" });
    expect(response.status).toBe(400);
  });

  it("con password incorrecta responde 401 y la cuenta sigue sin verificar", async () => {
    const user = await registerAndGetToken();
    const response = await request(app).post("/api/v1/auth/verify-email").send({ token: "tok", password: "Incorrecta123" });
    expect(response.status).toBe(401);
    expect((await User.findById(user._id))?.emailVerified).toBe(false);
  });

  it("con password correcta responde 200 y ya se puede ingresar", async () => {
    await registerAndGetToken();
    const verify = await request(app).post("/api/v1/auth/verify-email").send({ token: "tok", password: "Contrasena1" });
    expect(verify.status).toBe(200);
    const login = await request(app).post("/api/v1/auth/login").send({ email: BASE.email, password: "Contrasena1" });
    expect(login.status).toBe(200);
  });
});
