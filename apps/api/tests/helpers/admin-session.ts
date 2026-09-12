import type { Express } from "express";
import { authenticator } from "otplib";
import request from "supertest";
import { User } from "../../src/models/user.model.js";
import { encryptSecret } from "../../src/utils/crypto.js";

/**
 * Crea un admin ya verificado (sin 2FA, que es opt-in) y devuelve un agente
 * de supertest con la cookie de sesión ya puesta — evita repetir el flujo de
 * registro/login en cada test de ruta admin del catálogo.
 */
async function createAdminSession(app: Express) {
  const email = `admin-${Date.now()}-${Math.random()}@example.com`;
  const password = "Contrasena1";

  const admin = await User.create({
    email,
    password,
    firstName: "Admin",
    lastName: "Glow",
    role: "admin",
    emailVerified: true,
  });

  const agent = request.agent(app);
  const login = await agent.post("/api/v1/auth/login").send({ email, password });
  if (login.status !== 200) {
    throw new Error(`No se pudo crear la sesión de admin de prueba: ${JSON.stringify(login.body)}`);
  }

  return { agent, email, adminId: admin._id.toString() };
}

/**
 * Activa 2FA directamente en DB (sin pasar por el flujo de setup/QR) sobre
 * un admin ya creado — para probar rutas con step-up (`POST .../refund`,
 * decisión 9 del plan de 1.6) sin repetir el enrollment completo en cada
 * test. Devuelve el secreto EN CLARO: el test genera códigos válidos con
 * `authenticator.generate(secret)`.
 */
async function enableAdminTwoFactor(adminId: string): Promise<string> {
  const secret = authenticator.generateSecret();
  await User.updateOne(
    { _id: adminId },
    { $set: { "twoFactor.secret": encryptSecret(secret), "twoFactor.enabled": true } },
  );
  return secret;
}

/** Crea un customer regular ya verificado, con sesión — para probar 403 en rutas admin. */
async function createCustomerSession(app: Express) {
  const email = `customer-${Date.now()}-${Math.random()}@example.com`;
  const password = "Contrasena1";

  await User.create({
    email,
    password,
    firstName: "Cliente",
    lastName: "Glow",
    role: "customer",
    emailVerified: true,
  });

  const agent = request.agent(app);
  await agent.post("/api/v1/auth/login").send({ email, password });

  return { agent, email };
}

export { createAdminSession, createCustomerSession, enableAdminTwoFactor };
