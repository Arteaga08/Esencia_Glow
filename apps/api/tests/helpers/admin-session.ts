import type { Express } from "express";
import { authenticator } from "otplib";
import request from "supertest";
import { User } from "../../src/models/user.model.js";
import { encryptSecret } from "../../src/utils/crypto.js";

/**
 * Crea un admin ya verificado y devuelve un agente de supertest con la
 * cookie de sesión ya puesta — evita repetir el flujo de registro/login en
 * cada test de ruta admin del catálogo.
 *
 * Un admin sin 2FA ya no recibe sesión directa de `/login` (Milestone 2.1,
 * enrolamiento obligatorio) — `login()` solo deja un pending token de
 * enrolamiento. Este helper pasa por el mismo camino pre-auth que un admin
 * real recorrería la primera vez (login -> `/login/2fa/setup` ->
 * `/login/2fa/enroll`) en vez de activar 2FA directo en BD, para que los
 * tests de rutas admin ejerciten sesiones que de verdad pasarían por
 * `protect` (que ahora rechaza a un admin con `twoFactor.enabled: false`).
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
  if (login.status !== 200 || login.body.data?.next !== "twoFactorSetup") {
    throw new Error(`No se pudo iniciar el enrolamiento de 2FA de prueba: ${JSON.stringify(login.body)}`);
  }

  const setup = await agent.post("/api/v1/auth/login/2fa/setup");
  if (setup.status !== 200) {
    throw new Error(`No se pudo generar el secreto de 2FA de prueba: ${JSON.stringify(setup.body)}`);
  }
  const { manualEntryKey } = setup.body.data as { manualEntryKey: string };

  const enroll = await agent
    .post("/api/v1/auth/login/2fa/enroll")
    .send({ code: authenticator.generate(manualEntryKey) });
  if (enroll.status !== 200) {
    throw new Error(`No se pudo completar el enrolamiento de 2FA de prueba: ${JSON.stringify(enroll.body)}`);
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

  const customer = await User.create({
    email,
    password,
    firstName: "Cliente",
    lastName: "Glow",
    role: "customer",
    emailVerified: true,
  });

  const agent = request.agent(app);
  await agent.post("/api/v1/auth/login").send({ email, password });

  return { agent, email, userId: customer._id.toString() };
}

export { createAdminSession, createCustomerSession, enableAdminTwoFactor };
