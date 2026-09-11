import { OrderPriority, OrderStatus, ProductStatus } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Product } from "../../src/models/product.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { createAdminSession } from "../helpers/admin-session.js";
import { buildCreateOrderInput, resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";

const app = buildApp();

let seedCounter = 0;

async function seedOrderForUser(email: string, firstName: string, lastName: string) {
  seedCounter += 1;
  const suffix = seedCounter;
  const user = await User.create({
    email,
    password: "Contrasena1",
    firstName,
    lastName,
    role: "customer",
    emailVerified: true,
  });

  const category = await Category.create({ name: `Cat PN${suffix}`, slug: `cat-pn${suffix}` });
  const product = await Product.create({
    name: `Producto PN${suffix}`,
    slug: `producto-pn${suffix}`,
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: `SKU-PN${suffix}`,
        name: "Variante",
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand: 10, reserved: 0 });

  const input = await buildCreateOrderInput(user._id.toString(), [
    { itemType: "product", itemId: variant._id.toString(), quantity: 1 },
  ]);
  const { order } = await createOrder(input);
  return { order, user };
}

const NEW_ADDRESS = {
  fullName: "Otro Nombre",
  phone: "5599999999",
  street: "Otra calle",
  exteriorNumber: "200",
  neighborhood: "Del Valle",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "03100",
};

describe("routes/admin-order — panel: summary, búsqueda, dirección, prioridad, notas, lote, activity", () => {
  beforeEach(() => {
    seedCounter = 0;
    resetCheckoutFixtureCounter();
  });

  it("los conteos de /summary empatan con las filas que devuelve el filtro ?group del mismo bucket", async () => {
    const { order: pendingOrder } = await seedOrderForUser("uno@example.com", "Uno", "Glow");
    const { order: paidOrderSeed } = await seedOrderForUser("dos@example.com", "Dos", "Glow");
    await markOrderPaid({ orderId: paidOrderSeed._id.toString() });

    const { agent } = await createAdminSession(app);
    const summaryRes = await agent.get("/api/v1/admin/orders/summary");
    expect(summaryRes.status).toBe(200);

    const actionCount = summaryRes.body.data.action;
    const progressCount = summaryRes.body.data.progress;

    const actionFilter = await agent.get("/api/v1/admin/orders?group=action");
    expect(actionFilter.body.meta.total).toBe(actionCount);
    expect(actionFilter.body.data.map((o: { id: string }) => o.id)).toContain(pendingOrder._id.toString());

    const progressFilter = await agent.get("/api/v1/admin/orders?group=progress");
    expect(progressFilter.body.meta.total).toBe(progressCount);
    expect(progressFilter.body.data.map((o: { id: string }) => o.id)).toContain(paidOrderSeed._id.toString());
  });

  it("la búsqueda encuentra la orden por el correo del comprador, aunque su nombre no esté congelado en la orden", async () => {
    const { order } = await seedOrderForUser("buscable@example.com", "Buscable", "Persona");
    const { agent } = await createAdminSession(app);

    const res = await agent.get("/api/v1/admin/orders?search=buscable@example.com");
    expect(res.status).toBe(200);
    expect(res.body.data.map((o: { id: string }) => o.id)).toContain(order._id.toString());
  });

  it("orderNumber filtra con match exacto", async () => {
    const { order } = await seedOrderForUser("folio@example.com", "Folio", "Glow");
    const { agent } = await createAdminSession(app);

    const res = await agent.get(`/api/v1/admin/orders?orderNumber=${order.orderNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(order._id.toString());
  });

  it("corregir dirección: 200 en pending/paid, 409 en shipped", async () => {
    const { order } = await seedOrderForUser("addr@example.com", "Addr", "Glow");
    const { agent } = await createAdminSession(app);

    const okRes = await agent.patch(`/api/v1/admin/orders/${order._id}/shipping-address`).send(NEW_ADDRESS);
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.shippingAddress.fullName).toBe("Otro Nombre");

    await Order.updateOne({ _id: order._id }, { $set: { status: OrderStatus.SHIPPED } });
    const blockedRes = await agent.patch(`/api/v1/admin/orders/${order._id}/shipping-address`).send(NEW_ADDRESS);
    expect(blockedRes.status).toBe(409);
  });

  it("cambiar priority no altera status ni appendea a statusHistory", async () => {
    const { order } = await seedOrderForUser("prio@example.com", "Prio", "Glow");
    const beforeHistoryLength = order.statusHistory.length;
    const { agent } = await createAdminSession(app);

    const res = await agent.patch(`/api/v1/admin/orders/${order._id}/priority`).send({ priority: OrderPriority.URGENT });
    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe(OrderPriority.URGENT);
    expect(res.body.data.status).toBe(OrderStatus.PENDING);

    const reloaded = await Order.findById(order._id);
    expect(reloaded!.statusHistory).toHaveLength(beforeHistoryLength);
  });

  it("lote de 51 ids responde 400; un lote de 3 genera 3 entradas de audit, no 1", async () => {
    const { agent } = await createAdminSession(app);

    const tooMany = Array.from({ length: 51 }, () => "aaaaaaaaaaaaaaaaaaaaaaaa");
    const rejected = await agent.post("/api/v1/admin/orders/bulk-status").send({ orderIds: tooMany, status: OrderStatus.CANCELLED });
    expect(rejected.status).toBe(400);

    const orders = await Promise.all([
      seedOrderForUser("bulk1@example.com", "Bulk", "Uno"),
      seedOrderForUser("bulk2@example.com", "Bulk", "Dos"),
      seedOrderForUser("bulk3@example.com", "Bulk", "Tres"),
    ]);
    const orderIds = orders.map((o) => o.order._id.toString());

    const res = await agent.post("/api/v1/admin/orders/bulk-status").send({ orderIds, status: OrderStatus.CANCELLED });
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: { ok: boolean }) => r.ok)).toBe(true);

    const auditCount = await AuditLog.countDocuments({
      action: "order_cancelled",
      targetId: { $in: orderIds },
    });
    expect(auditCount).toBe(3);
  });

  it("/activity no expone metadata (before/after), solo quién hizo qué y cuándo", async () => {
    const { order } = await seedOrderForUser("activity@example.com", "Activity", "Glow");
    const { agent } = await createAdminSession(app);
    await agent.patch(`/api/v1/admin/orders/${order._id}/priority`).send({ priority: OrderPriority.HIGH });

    const res = await agent.get(`/api/v1/admin/orders/${order._id}/activity`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const entry of res.body.data) {
      expect(entry.metadata).toBeUndefined();
      expect(entry).toHaveProperty("action");
      expect(entry).toHaveProperty("at");
    }
  });

  it("internalNotes nunca aparece en la ruta de cliente, solo internalNotesCount en la de admin", async () => {
    const { order, user } = await seedOrderForUser("notes@example.com", "Notes", "Glow");
    const { agent } = await createAdminSession(app);

    const noteRes = await agent.post(`/api/v1/admin/orders/${order._id}/notes`).send({ body: "Nota interna de prueba" });
    expect(noteRes.status).toBe(201);
    expect(noteRes.body.data.internalNotesCount).toBe(1);
    expect(noteRes.body.data.internalNotes).toBeUndefined();

    const customerLogin = request.agent(app);
    await customerLogin.post("/api/v1/auth/login").send({ email: user.email, password: "Contrasena1" });
    const publicRes = await customerLogin.get(`/api/v1/orders/${order._id}`);
    expect(publicRes.body.data.internalNotes).toBeUndefined();
    expect(publicRes.body.data.internalNotesCount).toBeUndefined();
  });
});
