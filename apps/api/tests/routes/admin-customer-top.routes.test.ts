import { TopCustomersPeriod } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Order } from "../../src/models/order.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { resolvePeriodStart } from "../../src/utils/resolve-period-start.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { buildCreateOrderInput, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

const app = buildApp();

async function createCustomer(firstName: string) {
  const suffix = `${Date.now()}-${Math.random()}`;
  return User.create({
    email: `top-${suffix}@example.com`,
    password: "Contrasena1",
    firstName,
    lastName: "Prueba",
    role: "customer",
    emailVerified: true,
  });
}

/** Pedido pagado por el carril real de checkout; `createdAt` opcional se
 * reescribe directo en la colección (Mongoose no deja tocar el timestamp). */
async function seedPurchasedOrder(userId: string, priceCents: number, createdAt?: Date) {
  const { variantId } = await seedVariantWithStock({ price: priceCents });
  const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }]);
  const { order } = await createOrder(input);
  await markOrderPaid({ orderId: order._id.toString() });
  if (createdAt) await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt } });
  return Order.findById(order._id).lean();
}

describe("routes/admin-customer — GET /admin/customers/top", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("401 sin sesión, 403 con sesión de cliente", async () => {
    expect((await request(app).get("/api/v1/admin/customers/top")).status).toBe(401);
    const { agent } = await createCustomerSession(app);
    expect((await agent.get("/api/v1/admin/customers/top")).status).toBe(403);
  });

  it("400 con periodo o criterio fuera del enum", async () => {
    const { agent } = await createAdminSession(app);
    expect((await agent.get("/api/v1/admin/customers/top?period=day")).status).toBe(400);
    expect((await agent.get("/api/v1/admin/customers/top?sortBy=name")).status).toBe(400);
  });

  it("por default: mes en curso, ordenado por monto, con el rango consultado y solo las llaves del contrato", async () => {
    const ana = await createCustomer("Ana");
    const bea = await createCustomer("Bea");
    const anaOrder = await seedPurchasedOrder(ana._id.toString(), 10000);
    await seedPurchasedOrder(bea._id.toString(), 20000);
    await seedPurchasedOrder(bea._id.toString(), 5000);
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/customers/top");
    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe("month");
    expect(res.body.data.sortBy).toBe("spent");
    expect(new Date(res.body.data.from).toISOString()).toBe(resolvePeriodStart(TopCustomersPeriod.MONTH).toISOString());
    expect(res.body.data.rows.map((row: { firstName: string }) => row.firstName)).toEqual(["Bea", "Ana"]);
    expect(Object.keys(res.body.data.rows[1]).sort()).toEqual(["email", "firstName", "id", "lastName", "orderCount", "spentCents"]);
    expect(res.body.data.rows[1]).toMatchObject({ id: ana._id.toString(), orderCount: 1, spentCents: anaOrder!.totalCents });
  });

  it("sortBy=orders ordena por cantidad de pedidos y desempata por monto", async () => {
    const ana = await createCustomer("Ana");
    const bea = await createCustomer("Bea");
    const cris = await createCustomer("Cris");
    await seedPurchasedOrder(ana._id.toString(), 90000);
    await seedPurchasedOrder(bea._id.toString(), 1000);
    await seedPurchasedOrder(bea._id.toString(), 1000);
    await seedPurchasedOrder(cris._id.toString(), 2000);
    await seedPurchasedOrder(cris._id.toString(), 2000);
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/customers/top?sortBy=orders");
    expect(res.status).toBe(200);
    expect(res.body.data.rows.map((row: { firstName: string }) => row.firstName)).toEqual(["Cris", "Bea", "Ana"]);
  });

  it("solo cuenta pedidos comprados dentro del periodo; los de antes del inicio y los no pagados quedan fuera", async () => {
    const ana = await createCustomer("Ana");
    const bea = await createCustomer("Bea");
    const beforeYear = new Date(resolvePeriodStart(TopCustomersPeriod.YEAR).getTime() - 60_000);
    await seedPurchasedOrder(ana._id.toString(), 10000);
    await seedPurchasedOrder(ana._id.toString(), 50000, beforeYear);
    await seedPurchasedOrder(bea._id.toString(), 99000, beforeYear);
    // Pedido pendiente (sin pagar) de Bea dentro del periodo: no cuenta.
    const { variantId } = await seedVariantWithStock({ price: 70000 });
    await createOrder(await buildCreateOrderInput(bea._id.toString(), [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }]));
    const { agent } = await createAdminSession(app);

    const res = await agent.get(`/api/v1/admin/customers/top?period=${TopCustomersPeriod.YEAR}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0]).toMatchObject({ id: ana._id.toString(), orderCount: 1 });
  });

  it("nunca devuelve más de 10 filas ni incluye pedidos de un admin", async () => {
    const customers = await Promise.all(Array.from({ length: 11 }, (_, index) => createCustomer(`C${index}`)));
    for (const [index, customer] of customers.entries()) {
      await seedPurchasedOrder(customer._id.toString(), 1000 * (index + 1));
    }
    const { agent, adminId } = await createAdminSession(app);
    await seedPurchasedOrder(adminId, 999000);

    const res = await agent.get("/api/v1/admin/customers/top");
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(10);
    expect(res.body.data.rows.some((row: { id: string }) => row.id === adminId)).toBe(false);
    expect(res.body.data.rows[0].firstName).toBe("C10");
  });
});
