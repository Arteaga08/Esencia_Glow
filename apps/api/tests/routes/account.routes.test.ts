import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

describe("routes/account — acceso y perfil", () => {
  it("401 sin sesión", async () => {
    expect((await request(app).get("/api/v1/account")).status).toBe(401);
    expect((await request(app).patch("/api/v1/account/profile").send({})).status).toBe(401);
  });

  it("403 a un admin: es un recurso de clientas", async () => {
    const { agent } = await createAdminSession(app);
    expect((await agent.get("/api/v1/account")).status).toBe(403);
  });

  it("GET /account devuelve el DTO único sin campos sensibles", async () => {
    const { agent, email } = await createCustomerSession(app);
    const res = await agent.get("/api/v1/account");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      profile: { firstName: "Cliente", lastName: "Glow", email, phone: null, birthDate: null, city: null },
      addresses: [],
      billingInfo: null,
      wishlistCount: 0,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|sessionVersion|twoFactor/);
  });

  it("PATCH /account/profile guarda teléfono, nacimiento y ciudad", async () => {
    const { agent } = await createCustomerSession(app);
    const res = await agent
      .patch("/api/v1/account/profile")
      .send({ firstName: "María", lastName: "López", phone: "3312345678", birthDate: "1991-03-12", city: "Guadalajara" });

    expect(res.status).toBe(200);
    expect(res.body.data.profile).toMatchObject({
      firstName: "María",
      lastName: "López",
      phone: "3312345678",
      birthDate: "1991-03-12",
      city: "Guadalajara",
    });
    const again = await agent.get("/api/v1/account");
    expect(again.body.data.profile.birthDate).toBe("1991-03-12");
  });

  it("PATCH /account/profile con null borra un opcional", async () => {
    const { agent } = await createCustomerSession(app);
    await agent.patch("/api/v1/account/profile").send({ phone: "3312345678", city: "Zapopan" });
    const res = await agent.patch("/api/v1/account/profile").send({ phone: null });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.phone).toBeNull();
    expect(res.body.data.profile.city).toBe("Zapopan");
  });

  it("no deja cambiar correo, rol ni emailVerified por el body", async () => {
    const { agent, email, userId } = await createCustomerSession(app);
    const res = await agent
      .patch("/api/v1/account/profile")
      .send({ firstName: "Ana", email: "otro@example.com", role: "admin", emailVerified: false });

    expect(res.status).toBe(200);
    const user = await User.findById(userId);
    expect(user?.email).toBe(email);
    expect(user?.role).toBe("customer");
    expect(user?.emailVerified).toBe(true);
  });

  it("400 con errores por campo: teléfono, nacimiento futuro y HTML", async () => {
    const { agent } = await createCustomerSession(app);
    const res = await agent
      .patch("/api/v1/account/profile")
      .send({ phone: "123", birthDate: "2999-01-01", city: "<b>Gdl</b>" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(["phone", "birthDate", "city"]));
  });

  it("400 con birthDate anterior a 1900 (año 0001 no es una fecha de nacimiento)", async () => {
    const { agent } = await createCustomerSession(app);
    const res = await agent.patch("/api/v1/account/profile").send({ birthDate: "0001-01-01" });

    expect(res.status).toBe(400);
    expect(res.body.errors.birthDate).toBe("La fecha es demasiado antigua");
  });
});

describe("routes/account — datos de facturación", () => {
  const billing = { rfc: "LOMM910312AB1", legalName: "María López", cfdiUse: "G03", fiscalRegime: "612", postalCode: "44160" };

  it("PUT guarda y DELETE borra; cfdiUse y régimen son opcionales", async () => {
    const { agent } = await createCustomerSession(app);
    const put = await agent.put("/api/v1/account/billing-info").send({ rfc: billing.rfc, legalName: billing.legalName, postalCode: "44160" });

    expect(put.status).toBe(200);
    expect(put.body.data.billingInfo).toEqual({ rfc: billing.rfc, legalName: billing.legalName, cfdiUse: null, fiscalRegime: null, postalCode: "44160" });

    const full = await agent.put("/api/v1/account/billing-info").send(billing);
    expect(full.body.data.billingInfo).toEqual(billing);

    const del = await agent.delete("/api/v1/account/billing-info");
    expect(del.status).toBe(200);
    expect(del.body.data.billingInfo).toBeNull();
  });

  it("400 con RFC mal formado, CFDI fuera de catálogo y CP de 4 dígitos", async () => {
    const { agent } = await createCustomerSession(app);
    const res = await agent.put("/api/v1/account/billing-info").send({ rfc: "XX", legalName: "A", cfdiUse: "ZZZ", postalCode: "4416" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(["rfc", "cfdiUse", "postalCode"]));
  });
});
