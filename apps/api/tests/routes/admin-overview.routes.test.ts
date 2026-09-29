import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { buildCreateOrderInput, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

const app = buildApp();

describe("routes/admin-overview — GET /admin/overview/sales", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("401 sin sesión, 403 con sesión de cliente", async () => {
    expect((await request(app).get("/api/v1/admin/overview/sales?range=week")).status).toBe(401);
    const { agent } = await createCustomerSession(app);
    expect((await agent.get("/api/v1/admin/overview/sales?range=week")).status).toBe(403);
  });

  it("400 sin range y 400 con un range fuera del enum", async () => {
    const { agent } = await createAdminSession(app);
    expect((await agent.get("/api/v1/admin/overview/sales")).status).toBe(400);
    expect((await agent.get("/api/v1/admin/overview/sales?range=fortnight")).status).toBe(400);
  });

  it("200 con un pedido pagado: la cubeta de hoy refleja el ingreso", async () => {
    const { agent, adminId } = await createAdminSession(app);
    const { variantId } = await seedVariantWithStock({ price: 50000 });
    const input = await buildCreateOrderInput(adminId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }]);
    const { order } = await createOrder(input);
    await markOrderPaid({ orderId: order._id.toString() });

    const res = await agent.get("/api/v1/admin/overview/sales?range=week");

    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe("week");
    expect(res.body.data.buckets).toHaveLength(7);
    expect(res.body.data.totals.orderCount).toBe(1);
    expect(res.body.data.totals.storeRevenueCents).toBeGreaterThan(0);
  });
});
