import { OrderStatus, ProductStatus, ShippingCarrier } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Product } from "../../src/models/product.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { __setPaymentProviderForTests } from "../../src/services/payment-provider.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";

const app = buildApp();

let seedCounter = 0;

async function seedPendingOrder(onHand = 10) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat AO${suffix}`, slug: `cat-ao${suffix}` });
  const product = await Product.create({
    name: `Producto AO${suffix}`,
    slug: `producto-ao${suffix}`,
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: `SKU-AO${suffix}`,
        name: "Variante",
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand, reserved: 0 });

  const userId = randomUserId();
  // Usuaria real (no solo un id al aire): `ensurePaymentIntent` (Milestone
  // 1.6) hace `User.findById` para el `receipt_email` del PaymentIntent —
  // sin esto, cancelar un pedido CON intent lanzaría 404 antes de siquiera
  // tocar Stripe.
  await User.create({
    _id: userId,
    email: `ao${suffix}@example.com`,
    password: "P4ssword!!",
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: true,
  });
  const input = await buildCreateOrderInput(userId, [
    { itemType: "product", itemId: variant._id.toString(), quantity: 1 },
  ]);
  const { order } = await createOrder(input);
  return { order, variantId: variant._id };
}

describe("routes/admin-order — transiciones y guía", () => {
  beforeEach(() => {
    seedCounter = 0;
    resetCheckoutFixtureCounter();
  });

  it("una cookie de customer responde 403", async () => {
    const { order } = await seedPendingOrder();
    const { agent } = await createCustomerSession(app);
    const res = await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.PAID });
    expect(res.status).toBe(403);
  });

  it("ningún admin puede mover una orden a paid — eso solo lo decide el webhook (rechazado desde la validación)", async () => {
    const { order } = await seedPendingOrder();
    const { agent } = await createAdminSession(app);
    const res = await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.PAID });
    // `paid` ni siquiera es un valor aceptado por el validator para este
    // endpoint (ADMIN_REACHABLE_STATUSES) — la garantía a nivel de máquina
    // de estados (`admin` nunca puede `pending -> paid`) la cubre la matriz
    // de actores en order-state.test.ts.
    expect(res.status).toBe(400);

    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.PENDING);
  });

  it("pending -> shipped (saltando paid/processing) responde 409", async () => {
    const { order } = await seedPendingOrder();
    const { agent } = await createAdminSession(app);
    const res = await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({
      status: OrderStatus.SHIPPED,
      shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "TRACK1" },
    });
    expect(res.status).toBe(409);
  });

  it("🔀 dos PATCH /status concurrentes (paid -> processing) sobre la misma orden: uno 200, uno 409", async () => {
    const { order } = await seedPendingOrder();
    await markOrderPaid({ orderId: order._id.toString() });
    const { agent } = await createAdminSession(app);

    const [first, second] = await Promise.all([
      agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.PROCESSING }),
      agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.PROCESSING }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.PROCESSING);
  });

  it("corregir la guía no toca status", async () => {
    const { order } = await seedPendingOrder();
    await markOrderPaid({ orderId: order._id.toString() });
    const { agent } = await createAdminSession(app);

    await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.PROCESSING });
    await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({
      status: OrderStatus.SHIPPED,
      shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "TRACK1" },
    });

    const res = await agent
      .patch(`/api/v1/admin/orders/${order._id}/shipment`)
      .send({ trackingNumber: "TRACK-CORRECTED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(OrderStatus.SHIPPED);
    expect(res.body.data.shipment.trackingNumber).toBe("TRACK-CORRECTED");
  });

  it("corregir la guía sin que exista una previa responde 409", async () => {
    const { order } = await seedPendingOrder();
    const { agent } = await createAdminSession(app);
    const res = await agent
      .patch(`/api/v1/admin/orders/${order._id}/shipment`)
      .send({ trackingNumber: "TRACK-X" });
    expect(res.status).toBe(409);
  });

  it("cancelar pending con intent de tarjeta: Stripe-first, pasa por el adapter y libera stock", async () => {
    const { order, variantId } = await seedPendingOrder();
    const provider = buildFakePaymentProvider();
    __setPaymentProviderForTests(provider);
    await ensurePaymentIntent(order._id.toString(), order.userId.toString(), { provider });

    const { agent } = await createAdminSession(app);
    const res = await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.CANCELLED });

    expect(res.status).toBe(200);
    expect(provider.cancel).toHaveBeenCalledWith(expect.any(String), `order:${order._id.toString()}:cancel`);
    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.CANCELLED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);

    // El audit de la cancelación lleva metadata.from/to, igual que
    // cualquier otra transición admin (regresión detectada en code review).
    const audit = await AuditLog.findOne({ action: "order_cancelled", targetId: order._id });
    expect(audit?.metadata).toEqual({ from: OrderStatus.PENDING, to: OrderStatus.CANCELLED });
  });

  it("cancelar pending con anomalía de pago (monto no cuadra): 409 con mensaje de revisión, nunca 'ya se procesó'", async () => {
    const { order } = await seedPendingOrder();
    const provider = buildFakePaymentProvider({
      cancel: vi.fn().mockResolvedValue("already_captured"),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_anomaly",
        status: "captured",
        amountCents: order.totalCents + 100,
        currency: order.currency,
      }),
    });
    __setPaymentProviderForTests(provider);
    await ensurePaymentIntent(order._id.toString(), order.userId.toString(), { provider });

    const { agent } = await createAdminSession(app);
    const res = await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.CANCELLED });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/anomalía/i);
    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.PENDING);
  });

  it("cancelar pending cuyo pago ya se capturó en Stripe: 409, la orden queda paid (nunca cancelada)", async () => {
    const { order } = await seedPendingOrder();
    const provider = buildFakePaymentProvider({
      cancel: vi.fn().mockResolvedValue("already_captured"),
      getAuthorization: vi.fn().mockResolvedValue({
        intentId: "pi_captured",
        status: "captured",
        amountCents: order.totalCents,
        currency: order.currency,
        card: { brand: "visa", last4: "4242" },
      }),
    });
    __setPaymentProviderForTests(provider);
    await ensurePaymentIntent(order._id.toString(), order.userId.toString(), { provider });

    const { agent } = await createAdminSession(app);
    const res = await agent.patch(`/api/v1/admin/orders/${order._id}/status`).send({ status: OrderStatus.CANCELLED });

    expect(res.status).toBe(409);
    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.PAID);
  });

  it("bulk-status con pending sin intent sigue cancelando directo (sin llamar a Stripe)", async () => {
    const { order } = await seedPendingOrder();
    const { agent } = await createAdminSession(app);

    const res = await agent.post("/api/v1/admin/orders/bulk-status").send({ orderIds: [order._id.toString()], status: OrderStatus.CANCELLED });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({ orderId: order._id.toString(), ok: true });
    const reloaded = await Order.findById(order._id);
    expect(reloaded!.status).toBe(OrderStatus.CANCELLED);
  });

  it("bulk-status cancela un pending con intent de tarjeta pasando por Stripe", async () => {
    const { order, variantId } = await seedPendingOrder();
    const provider = buildFakePaymentProvider();
    __setPaymentProviderForTests(provider);
    await ensurePaymentIntent(order._id.toString(), order.userId.toString(), { provider });

    const { agent } = await createAdminSession(app);
    const res = await agent.post("/api/v1/admin/orders/bulk-status").send({ orderIds: [order._id.toString()], status: OrderStatus.CANCELLED });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({ orderId: order._id.toString(), ok: true });
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });
});
