import { randomUUID } from "node:crypto";
import { ErrorCode, ProductStatus } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import { CHECKOUT_DESTINATION, resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";

const app = buildApp();

let seedCounter = 0;

async function seedProduct(opts: { onHand?: number; status?: ProductStatus } = {}) {
  seedCounter += 1;
  const category = await Category.create({ name: `Cat CE${seedCounter}`, slug: `cat-ce${seedCounter}` });
  const product = await Product.create({
    name: `Producto CE${seedCounter}`,
    slug: `producto-ce${seedCounter}`,
    description: "d",
    categoryId: category._id,
    status: opts.status ?? ProductStatus.ACTIVE,
    variants: [
      { sku: `SKU-CE${seedCounter}`, name: "Variante", price: 50000, weightGrams: 200, dimensionsCm: { length: 10, width: 10, height: 10 }, isActive: true },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand: opts.onHand ?? 10, reserved: 0 });
  return variant._id.toString();
}

type Agent = ReturnType<typeof request.agent>;

async function quote(agent: Agent, variantId: string, quantity = 1) {
  const lines = [{ itemType: "product", itemId: variantId, quantity }];
  const res = await agent.post("/api/v1/shipping/quotes").send({ destination: CHECKOUT_DESTINATION, lines });
  return { lines, quoteId: res.body.data.id as string, rateId: res.body.data.rates[0].rateId as string };
}

function placeOrder(agent: Agent, body: Record<string, unknown>) {
  return agent.post("/api/v1/orders").set("Idempotency-Key", randomUUID()).send({ paymentMethod: "card", termsAccepted: true, ...body });
}

/** El front decide qué hacer por `code`, nunca por el texto del mensaje (mismo criterio que 3.5c). */
describe("routes — code estable en los 409 del checkout", () => {
  beforeEach(() => {
    seedCounter = 0;
    resetCheckoutFixtureCounter();
  });

  it("una tarifa vencida o inexistente trae SHIPPING_QUOTE_INVALID", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const { lines, quoteId } = await quote(agent, variantId);

    const res = await placeOrder(agent, { lines, quoteId, rateId: "rate-inexistente" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.SHIPPING_QUOTE_INVALID);
  });

  it("un carrito distinto al cotizado trae CART_CHANGED", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const { quoteId, rateId } = await quote(agent, variantId, 1);

    const res = await placeOrder(agent, { lines: [{ itemType: "product", itemId: variantId, quantity: 3 }], quoteId, rateId });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.CART_CHANGED);
  });

  it("sin stock suficiente trae ITEM_UNAVAILABLE", async () => {
    const variantId = await seedProduct({ onHand: 1 });
    const { agent } = await createCustomerSession(app);
    const { lines, quoteId, rateId } = await quote(agent, variantId, 2);

    const res = await placeOrder(agent, { lines, quoteId, rateId });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.ITEM_UNAVAILABLE);
  });

  it("cotizar algo que ya no se vende trae ITEM_UNAVAILABLE", async () => {
    const variantId = await seedProduct({ status: ProductStatus.ARCHIVED });
    const { agent } = await createCustomerSession(app);

    const res = await agent.post("/api/v1/shipping/quotes").send({ destination: CHECKOUT_DESTINATION, lines: [{ itemType: "product", itemId: variantId, quantity: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.ITEM_UNAVAILABLE);
  });

  it("un segundo pedido con uno pendiente trae PENDING_ORDER_EXISTS y el orderId", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const first = await quote(agent, variantId);
    const created = await placeOrder(agent, first);
    expect(created.status).toBe(201);
    const second = await quote(agent, variantId);

    const res = await placeOrder(agent, second);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.PENDING_ORDER_EXISTS);
    expect(res.body.errors.orderId).toBe(created.body.data.order.id);
  });
});
