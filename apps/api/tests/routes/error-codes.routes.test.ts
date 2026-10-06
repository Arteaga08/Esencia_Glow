import { ErrorCode } from "@esencia-glow/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

/** Un `code` estable permite al front decidir sin leer el texto del mensaje. */
describe("routes — code estable en los errores", () => {
  it("login antes de verificar el correo trae EMAIL_NOT_VERIFIED", async () => {
    const email = `codigo-${Date.now()}@example.com`;
    await request(app).post("/api/v1/auth/register").send({ email, password: "Contrasena1", firstName: "Ana", lastName: "Pérez" });

    const response = await request(app).post("/api/v1/auth/login").send({ email, password: "Contrasena1" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.EMAIL_NOT_VERIFIED);
  });

  it("cambiar la contraseña con la actual mal trae CURRENT_PASSWORD_INCORRECT", async () => {
    const { agent } = await createCustomerSession(app);

    const response = await agent.patch("/api/v1/auth/password").send({ currentPassword: "Equivocada1", newPassword: "OtraContrasena9" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.CURRENT_PASSWORD_INCORRECT);
  });

  it("un origen no permitido trae ORIGIN_NOT_ALLOWED", async () => {
    const response = await request(app).post("/api/v1/auth/login").set("Origin", "https://evil.example").send({ email: "a@b.mx", password: "x" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.ORIGIN_NOT_ALLOWED);
  });

  it("un 401 de sesión (sin cookie) no trae code: el front lo trata como sesión vencida", async () => {
    const response = await request(app).get("/api/v1/account");

    expect(response.status).toBe(401);
    expect(response.body).not.toHaveProperty("code");
  });
});
