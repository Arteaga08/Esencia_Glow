import type { Express } from "express";
import request from "supertest";
import { User } from "../../src/models/user.model.js";

/**
 * Crea un admin ya verificado (sin 2FA, que es opt-in) y devuelve un agente
 * de supertest con la cookie de sesión ya puesta — evita repetir el flujo de
 * registro/login en cada test de ruta admin del catálogo.
 */
async function createAdminSession(app: Express) {
  const email = `admin-${Date.now()}-${Math.random()}@example.com`;
  const password = "Contrasena1";

  await User.create({
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

  return { agent, email };
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

export { createAdminSession, createCustomerSession };
