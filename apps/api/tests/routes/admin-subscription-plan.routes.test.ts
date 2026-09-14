import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

function samplePlan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Caja Esencial",
    description: "Caja mensual curada",
    priceCents: 49900,
    maxActiveSeats: 100,
    ...overrides,
  };
}

describe("routes/admin-subscription-plan — CRUD de planes", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/subscription-plans");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/subscription-plans");
    expect(response.status).toBe(403);
  });

  it("priceCents no entero responde 400 con el mapa de errors", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .post("/api/v1/admin/subscription-plans")
      .send(samplePlan({ priceCents: 499.5 }));
    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it("maxActiveSeats negativo responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .post("/api/v1/admin/subscription-plans")
      .send(samplePlan({ maxActiveSeats: -1 }));
    expect(response.status).toBe(400);
  });

  it("golden path: crear -> listar -> obtener -> actualizar -> desactivar", async () => {
    const { agent } = await createAdminSession(app);

    const create = await agent.post("/api/v1/admin/subscription-plans").send(samplePlan());
    expect(create.status).toBe(201);
    expect(create.body.data.slug).toBe("caja-esencial");
    expect(create.body.data.isActive).toBe(true);
    expect(create.body.data.seatsTaken).toBe(0);
    const id = create.body.data.id as string;

    const list = await agent.get("/api/v1/admin/subscription-plans");
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);

    const getOne = await agent.get(`/api/v1/admin/subscription-plans/${id}`);
    expect(getOne.status).toBe(200);

    const update = await agent
      .patch(`/api/v1/admin/subscription-plans/${id}`)
      .send({ sortOrder: 5 });
    expect(update.status).toBe(200);
    expect(update.body.data.sortOrder).toBe(5);

    const deactivate = await agent.delete(`/api/v1/admin/subscription-plans/${id}`);
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);

    const afterDeactivate = await agent.get(`/api/v1/admin/subscription-plans/${id}`);
    expect(afterDeactivate.body.data.isActive).toBe(false);
  });

  it("GET /:id con un id de 24 hex inexistente responde 404; id malformado responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const notFound = await agent.get("/api/v1/admin/subscription-plans/aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(notFound.status).toBe(404);

    const malformed = await agent.get("/api/v1/admin/subscription-plans/not-an-id");
    expect(malformed.status).toBe(400);
  });

  it("PATCH con solo priceCents responde 400 (el precio es inmutable para siempre, decisión 1 de 1.7.2a)", async () => {
    const { agent } = await createAdminSession(app);
    const create = await agent.post("/api/v1/admin/subscription-plans").send(samplePlan());
    const id = create.body.data.id as string;

    const update = await agent
      .patch(`/api/v1/admin/subscription-plans/${id}`)
      .send({ priceCents: 59900 });
    expect(update.status).toBe(400);

    const unchanged = await agent.get(`/api/v1/admin/subscription-plans/${id}`);
    expect(unchanged.body.data.priceCents).toBe(49900);
  });

  it("sin proveedor de suscripciones configurado, crear un plan responde 503", async () => {
    const { __setSubscriptionProviderForTests } = await import("../../src/services/subscription-provider.js");
    __setSubscriptionProviderForTests(undefined);

    const { agent } = await createAdminSession(app);
    const response = await agent.post("/api/v1/admin/subscription-plans").send(samplePlan());
    expect(response.status).toBe(503);
  });

  it("paginación respeta page/limit", async () => {
    const { agent } = await createAdminSession(app);
    await agent.post("/api/v1/admin/subscription-plans").send(samplePlan({ name: "Plan A" }));
    await agent.post("/api/v1/admin/subscription-plans").send(samplePlan({ name: "Plan B" }));

    const response = await agent.get("/api/v1/admin/subscription-plans").query({ page: 1, limit: 1 });
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 1, total: 2 });
  });
});
