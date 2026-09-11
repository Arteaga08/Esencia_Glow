import { randomUUID } from "node:crypto";
import { OrderStatus, ProductStatus } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Product } from "../../src/models/product.model.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import { CHECKOUT_DESTINATION, resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";

const app = buildApp();

let seedCounter = 0;

async function seedProduct(opts: { price?: number; onHand?: number } = {}) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat OR${suffix}`, slug: `cat-or${suffix}` });
  const product = await Product.create({
    name: `Producto OR${suffix}`,
    slug: `producto-or${suffix}`,
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: `SKU-OR${suffix}`,
        name: "Variante",
        price: opts.price ?? 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({
    productId: product._id,
    variantId: variant._id,
    sku: variant.sku,
    onHand: opts.onHand ?? 10,
    reserved: 0,
  });
  return { variantId: variant._id.toString(), sku: variant.sku };
}

/** Cotiza envío vía HTTP (como lo haría el cliente real) y devuelve
 * {quoteId, rateId} listos para POST /orders — las MISMAS líneas que se
 * usarán en el checkout, para que el `cartFingerprint` coincida. */
async function quoteViaHttp(agent: ReturnType<typeof request.agent>, lines: unknown[]) {
  const res = await agent.post("/api/v1/shipping/quotes").send({ destination: CHECKOUT_DESTINATION, lines });
  return { quoteId: res.body.data.id as string, rateId: res.body.data.rates[0].rateId as string };
}

async function checkoutPayload(agent: ReturnType<typeof request.agent>, variantId: string, quantity = 1) {
  const lines = [{ itemType: "product", itemId: variantId, quantity }];
  const { quoteId, rateId } = await quoteViaHttp(agent, lines);
  return { lines, quoteId, rateId, termsAccepted: true };
}

describe("routes/order — checkout, lectura y cancelación del cliente", () => {
  beforeEach(() => {
    seedCounter = 0;
    resetCheckoutFixtureCounter();
  });

  it("401 sin sesión en POST /orders", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Idempotency-Key", randomUUID())
      .send({ lines: [], quoteId: "x", rateId: "x", termsAccepted: true });
    expect(res.status).toBe(401);
  });

  it("400 sin header Idempotency-Key", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const payload = await checkoutPayload(agent, variantId);

    const res = await agent.post("/api/v1/orders").send(payload);
    expect(res.status).toBe(400);
  });

  it("201 feliz: crea la orden con totales calculados en el servidor, ignorando montos del cliente", async () => {
    const { variantId, sku } = await seedProduct({ price: 50000 });
    const { agent } = await createCustomerSession(app);
    const payload = await checkoutPayload(agent, variantId, 2);

    const res = await agent
      .post("/api/v1/orders")
      .set("Idempotency-Key", randomUUID())
      // Manipulación de montos: el cliente intenta mandar sus propios totales.
      .send({ ...payload, totalCents: 1, unitPriceCents: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe(OrderStatus.PENDING);
    expect(res.body.data.order.lines[0].sku).toBe(sku);
    expect(res.body.data.order.totals.subtotalCents).toBe(100000);
    expect(res.body.data.order.totals.totalCents).not.toBe(1);
  });

  it("sin termsAccepted responde 400", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const payload = await checkoutPayload(agent, variantId);

    const res = await agent
      .post("/api/v1/orders")
      .set("Idempotency-Key", randomUUID())
      .send({ ...payload, termsAccepted: false });

    expect(res.status).toBe(400);
  });

  it("un rateId vencido/ajeno se rechaza con 409", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const payload = await checkoutPayload(agent, variantId);

    const res = await agent
      .post("/api/v1/orders")
      .set("Idempotency-Key", randomUUID())
      .send({ ...payload, rateId: "rate-inexistente" });

    expect(res.status).toBe(409);
  });

  it("replay por HTTP con la misma Idempotency-Key devuelve la misma orden con 200", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const payload = await checkoutPayload(agent, variantId);
    const key = randomUUID();

    const first = await agent.post("/api/v1/orders").set("Idempotency-Key", key).send(payload);
    const second = await agent.post("/api/v1/orders").set("Idempotency-Key", key).send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.order.id).toBe(first.body.data.order.id);
  });

  it("anti-IDOR: el cliente B pide la orden del cliente A y recibe 404, no 403", async () => {
    const { variantId } = await seedProduct();
    const { agent: agentA } = await createCustomerSession(app);
    const payload = await checkoutPayload(agentA, variantId);
    const created = await agentA.post("/api/v1/orders").set("Idempotency-Key", randomUUID()).send(payload);
    const orderId = created.body.data.order.id;

    const { agent: agentB } = await createCustomerSession(app);
    const res = await agentB.get(`/api/v1/orders/${orderId}`);

    expect(res.status).toBe(404);
  });

  it("GET /orders solo devuelve las propias", async () => {
    const { variantId: variantA } = await seedProduct();
    const { variantId: variantB } = await seedProduct();
    const { agent: agentA } = await createCustomerSession(app);
    const { agent: agentB } = await createCustomerSession(app);

    const payloadA = await checkoutPayload(agentA, variantA);
    await agentA.post("/api/v1/orders").set("Idempotency-Key", randomUUID()).send(payloadA);
    const payloadB = await checkoutPayload(agentB, variantB);
    await agentB.post("/api/v1/orders").set("Idempotency-Key", randomUUID()).send(payloadB);

    const res = await agentA.get("/api/v1/orders");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("cancelar una orden pending responde 200 y libera la reserva", async () => {
    const { variantId } = await seedProduct({ onHand: 10 });
    const { agent } = await createCustomerSession(app);
    const payload = await checkoutPayload(agent, variantId);
    const created = await agent.post("/api/v1/orders").set("Idempotency-Key", randomUUID()).send(payload);
    const orderId = created.body.data.order.id;

    const res = await agent.post(`/api/v1/orders/${orderId}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
  });

  it("cancelar una orden ya paid responde 409", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const payload = await checkoutPayload(agent, variantId);
    const created = await agent.post("/api/v1/orders").set("Idempotency-Key", randomUUID()).send(payload);
    const orderId = created.body.data.order.id;

    await Order.updateOne({ _id: orderId }, { $set: { status: OrderStatus.PAID } });

    const res = await agent.post(`/api/v1/orders/${orderId}/cancel`);
    expect(res.status).toBe(409);
  });
});
