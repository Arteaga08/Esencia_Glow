import request from "supertest";
import { SubscriptionAction } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

/** Un día-ancla que garantiza que la PRÓXIMA ocurrencia caiga el mes que
 * viene (~27-31 días de margen, más que suficiente para el default de 15
 * días + el gap de 7) — así las pruebas de apertura no dependen de qué día
 * del mes corran de verdad. "El día justo antes de hoy" empuja
 * `nextAnchorOnOrAfter` a saltar al mes siguiente; si hoy es el día 1, no
 * hay "día antes" dentro del mismo mes, así que se usa el 28 (fin de mes,
 * también lejos). */
function pickSafeAnchorDay(): number {
  const todayDay = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", day: "numeric" })
      .formatToParts(new Date())
      .find((part) => part.type === "day")?.value,
  );
  return todayDay > 1 ? todayDay - 1 : 28;
}

describe("routes/admin-subscription-enrollment", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).post("/api/v1/admin/subscriptions/enrollment/open");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.post("/api/v1/admin/subscriptions/enrollment/open");
    expect(response.status).toBe(403);
  });

  it("abre con duración custom, persiste y se refleja en GET /admin/settings", async () => {
    const { agent } = await createAdminSession(app);
    await agent
      .patch("/api/v1/admin/settings/subscriptions")
      .send({ billingAnchorDay: pickSafeAnchorDay() });

    const open = await agent
      .post("/api/v1/admin/subscriptions/enrollment/open")
      .send({ durationDays: 1 });
    expect(open.status).toBe(200);
    expect(open.body.data.enrollmentOpen).toBe(true);
    expect(open.body.data.enrollmentClosesAt).toBeDefined();

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.subscriptions.enrollmentOpen).toBe(true);

    const entry = await AuditLog.findOne({ action: SubscriptionAction.SUBSCRIPTION_ENROLLMENT_OPENED });
    expect(entry).not.toBeNull();
  });

  it("abre sin body con la duración default", async () => {
    const { agent } = await createAdminSession(app);
    await agent
      .patch("/api/v1/admin/settings/subscriptions")
      .send({ billingAnchorDay: pickSafeAnchorDay() });

    const open = await agent.post("/api/v1/admin/subscriptions/enrollment/open");
    expect(open.status).toBe(200);
    expect(open.body.data.enrollmentOpen).toBe(true);
  });

  it("rechaza (409) abrir una ventana que se traslapa con el próximo ancla, sin escribir nada", async () => {
    const { agent } = await createAdminSession(app);
    // billingAnchorDay queda en su default (1); una ventana de 40 días
    // siempre cae encima de algún ancla mensual, sin importar la fecha real.
    const open = await agent
      .post("/api/v1/admin/subscriptions/enrollment/open")
      .send({ durationDays: 40 });
    expect(open.status).toBe(409);

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.subscriptions.enrollmentOpen).toBe(false);
  });

  it("cierra la inscripción abierta", async () => {
    const { agent } = await createAdminSession(app);
    await agent
      .patch("/api/v1/admin/settings/subscriptions")
      .send({ billingAnchorDay: pickSafeAnchorDay() });
    await agent.post("/api/v1/admin/subscriptions/enrollment/open").send({ durationDays: 1 });

    const close = await agent.post("/api/v1/admin/subscriptions/enrollment/close");
    expect(close.status).toBe(200);
    expect(close.body.data.enrollmentOpen).toBe(false);

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.subscriptions.enrollmentOpen).toBe(false);

    const entry = await AuditLog.findOne({ action: SubscriptionAction.SUBSCRIPTION_ENROLLMENT_CLOSED });
    expect(entry).not.toBeNull();
  });
});
