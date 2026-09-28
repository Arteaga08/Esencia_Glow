import { SubscriptionStatus } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Order } from "../../src/models/order.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { buildCreateOrderInput, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";
import { seedSubscribedAccount } from "../helpers/subscription-fixtures.js";

const app = buildApp();

async function createCustomer(overrides: Partial<{ email: string; firstName: string; lastName: string }> = {}) {
  const suffix = `${Date.now()}-${Math.random()}`;
  const user = await User.create({
    email: overrides.email ?? `cliente-${suffix}@example.com`,
    password: "Contrasena1",
    firstName: overrides.firstName ?? "Ana",
    lastName: overrides.lastName ?? "Pérez",
    role: "customer",
    emailVerified: true,
  });
  return user;
}

/** Crea un pedido pagado para `userId`, reusando el mismo carril crítico de
 * checkout que el resto de la suite (`checkout-fixtures.ts`). */
async function seedPurchasedOrder(userId: string) {
  const { variantId } = await seedVariantWithStock({ price: 50000 });
  const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }]);
  const { order } = await createOrder(input);
  await markOrderPaid({ orderId: order._id.toString() });
  return order;
}

async function createPlan(overrides: Partial<{ priceCents: number }> = {}) {
  const suffix = `${Date.now()}-${Math.random()}`;
  return SubscriptionPlan.create({
    name: `Plan ${suffix}`,
    slug: `plan-${suffix}`,
    description: "Caja mensual de prueba",
    priceCents: overrides.priceCents ?? 39900,
    currency: "mxn",
    billingInterval: "month",
    maxActiveSeats: 10,
    seatsTaken: 0,
    isActive: true,
    sortOrder: 0,
  });
}

describe("routes/admin-customer — listado y detalle", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("401 sin sesión, 403 con sesión de cliente, en listado y detalle", async () => {
    const customer = await createCustomer();

    const anonList = await request(app).get("/api/v1/admin/customers");
    expect(anonList.status).toBe(401);
    const anonDetail = await request(app).get(`/api/v1/admin/customers/${customer._id}`);
    expect(anonDetail.status).toBe(401);

    const { agent } = await createCustomerSession(app);
    const customerList = await agent.get("/api/v1/admin/customers");
    expect(customerList.status).toBe(403);
    const customerDetail = await agent.get(`/api/v1/admin/customers/${customer._id}`);
    expect(customerDetail.status).toBe(403);
  });

  it("el listado solo trae clientes, nunca admins, y cada fila expone exactamente las llaves del contrato", async () => {
    const customer = await createCustomer({ email: "sola@example.com" });
    const { agent, adminId } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/customers");
    expect(res.status).toBe(200);

    const ids = res.body.data.map((row: { id: string }) => row.id);
    expect(ids).toContain(customer._id.toString());
    expect(ids).not.toContain(adminId);

    const row = res.body.data.find((r: { id: string }) => r.id === customer._id.toString());
    expect(Object.keys(row).sort()).toEqual(
      ["id", "firstName", "lastName", "email", "emailVerified", "createdAt", "stats", "subscriptionStatus"].sort(),
    );
    expect(row).not.toHaveProperty("password");
    expect(row).not.toHaveProperty("twoFactor");
    expect(row).not.toHaveProperty("sessionVersion");
    expect(row).not.toHaveProperty("role");
    expect(row).not.toHaveProperty("passwordChangedAt");
  });

  it("busca por correo, nombre y apellido, sin distinguir mayúsculas", async () => {
    const customer = await createCustomer({ email: "buscable@example.com", firstName: "Buscable", lastName: "Persona" });
    const { agent } = await createAdminSession(app);

    const byEmail = await agent.get("/api/v1/admin/customers?search=BUSCABLE@example.com");
    expect(byEmail.body.data.map((r: { id: string }) => r.id)).toContain(customer._id.toString());

    const byFirstName = await agent.get("/api/v1/admin/customers?search=buscable");
    expect(byFirstName.body.data.map((r: { id: string }) => r.id)).toContain(customer._id.toString());

    const byLastName = await agent.get("/api/v1/admin/customers?search=persona");
    expect(byLastName.body.data.map((r: { id: string }) => r.id)).toContain(customer._id.toString());
  });

  it("un patrón de regex en la búsqueda se trata como texto literal, sin 500 ni match total", async () => {
    await createCustomer({ email: "normal@example.com" });
    const { agent } = await createAdminSession(app);

    const wildcard = await agent.get("/api/v1/admin/customers?search=.*");
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.data).toHaveLength(0);

    const unbalancedParen = await agent.get(`/api/v1/admin/customers?search=${encodeURIComponent("(")}`);
    expect(unbalancedParen.status).toBe(200);
    expect(unbalancedParen.body.data).toHaveLength(0);
  });

  it("pagina con meta.total correcto y respeta ?limit", async () => {
    for (let i = 0; i < 3; i += 1) {
      await createCustomer();
    }
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/customers?limit=2&page=1");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(res.body.meta.limit).toBe(2);
  });

  it("un sort fuera de whitelist cae al fallback en vez de fallar", async () => {
    await createCustomer();
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/customers?sort=password");
    expect(res.status).toBe(200);
  });

  it("las métricas solo cuentan pedidos comprados: pending/cancelled/refunded quedan fuera", async () => {
    const customer = await createCustomer({ email: "metricas@example.com" });
    const { agent } = await createAdminSession(app);

    // pedido pagado real
    const purchased = await seedPurchasedOrder(customer._id.toString());

    // pedido pending (checkout abandonado, nunca pagado) — se crea DESPUÉS
    // del pagado: un cliente solo puede tener un `pending` a la vez (índice
    // único parcial de order.model.ts), y el pagado ya no ocupa ese lugar.
    const { variantId } = await seedVariantWithStock({ price: 20000 });
    const pendingInput = await buildCreateOrderInput(customer._id.toString(), [
      { itemType: "product" as const, itemId: variantId.toString(), quantity: 1 },
    ]);
    await createOrder(pendingInput);

    const res = await agent.get("/api/v1/admin/customers");
    const row = res.body.data.find((r: { id: string }) => r.id === customer._id.toString());
    expect(row.stats.orderCount).toBe(1);
    expect(row.stats.spentCents).toBe(purchased.totalCents);
    expect(row.stats.lastOrderAt).toBeTruthy();
  });

  it("un cliente sin pedidos tiene métricas en cero y lastOrderAt null", async () => {
    const customer = await createCustomer({ email: "sinpedidos@example.com" });
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/customers");
    const row = res.body.data.find((r: { id: string }) => r.id === customer._id.toString());
    expect(row.stats).toEqual({ orderCount: 0, spentCents: 0, lastOrderAt: null });
  });

  it("expone el estatus de suscripción en la fila del listado", async () => {
    const customer = await createCustomer({ email: "suscrita@example.com" });
    const plan = await createPlan();
    await seedSubscribedAccount({ planId: plan._id.toString(), userId: customer._id.toString(), status: SubscriptionStatus.ACTIVE });

    const { agent } = await createAdminSession(app);
    const res = await agent.get("/api/v1/admin/customers");
    const row = res.body.data.find((r: { id: string }) => r.id === customer._id.toString());
    expect(row.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
  });

  it("un cliente sin cuenta de suscripción tiene subscriptionStatus null", async () => {
    const customer = await createCustomer({ email: "sinsub@example.com" });
    const { agent } = await createAdminSession(app);
    const res = await agent.get("/api/v1/admin/customers");
    const row = res.body.data.find((r: { id: string }) => r.id === customer._id.toString());
    expect(row.subscriptionStatus).toBeNull();
  });

  it("detalle: 400 con id inválido", async () => {
    const { agent } = await createAdminSession(app);
    const res = await agent.get("/api/v1/admin/customers/no-es-un-id");
    expect(res.status).toBe(400);
  });

  it("detalle: 404 con id inexistente", async () => {
    const { agent } = await createAdminSession(app);
    const res = await agent.get("/api/v1/admin/customers/000000000000000000000000");
    expect(res.status).toBe(404);
  });

  it("detalle: 404 si el id pertenece a un admin, no a un cliente", async () => {
    const { agent, adminId } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/customers/${adminId}`);
    expect(res.status).toBe(404);
  });

  it("detalle: lastShippingAddress es la del pedido comprado más reciente, y trae la suscripción sin datos de proveedor", async () => {
    const customer = await createCustomer({ email: "detalle@example.com" });
    const older = await seedPurchasedOrder(customer._id.toString());
    await Order.updateOne({ _id: older._id }, { $set: { createdAt: new Date(Date.now() - 60_000) } });
    const newer = await seedPurchasedOrder(customer._id.toString());

    const plan = await createPlan();
    const account = await seedSubscribedAccount({
      planId: plan._id.toString(),
      userId: customer._id.toString(),
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: "sub_fake_1",
      providerCustomerId: "cus_fake_1",
    });

    const { agent } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/customers/${customer._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lastShippingAddress.fullName).toBe(newer.shippingAddress.fullName);
    expect(res.body.data.lastShippingAddress.postalCode).toBe(newer.shippingAddress.postalCode);

    expect(res.body.data.subscription.id).toBe(account._id.toString());
    expect(res.body.data.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(res.body.data.subscription.plan).toEqual({
      id: plan._id.toString(),
      name: plan.name,
      priceCents: plan.priceCents,
      currency: plan.currency,
    });
    expect(res.body.data.subscription).not.toHaveProperty("providerSubscriptionId");
    expect(res.body.data.subscription).not.toHaveProperty("providerCustomerId");
    expect(res.body.data.subscription).not.toHaveProperty("cancelReason");
    expect(res.body.data.subscription).not.toHaveProperty("statusHistory");
  });

  it("detalle: lastShippingAddress y subscription son null cuando el cliente no tiene ninguna de las dos", async () => {
    const customer = await createCustomer({ email: "vacio@example.com" });
    const { agent } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/customers/${customer._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lastShippingAddress).toBeNull();
    expect(res.body.data.subscription).toBeNull();
  });
});

describe("routes/admin-order — filtro ?customerId", () => {
  it("filtra los pedidos de un solo cliente y rechaza un id inválido con 400", async () => {
    const customerA = await createCustomer({ email: "cliente-a@example.com" });
    const customerB = await createCustomer({ email: "cliente-b@example.com" });
    const orderA = await seedPurchasedOrder(customerA._id.toString());
    await seedPurchasedOrder(customerB._id.toString());

    const { agent } = await createAdminSession(app);
    const res = await agent.get(`/api/v1/admin/orders?customerId=${customerA._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(orderA._id.toString());

    const invalid = await agent.get("/api/v1/admin/orders?customerId=no-es-un-id");
    expect(invalid.status).toBe(400);
  });
});
