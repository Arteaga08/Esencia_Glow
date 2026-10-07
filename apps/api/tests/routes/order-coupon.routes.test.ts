import { randomUUID } from "node:crypto";
import { CouponKind, ErrorCode, ProductStatus } from "@esencia-glow/shared";
import { Types } from "mongoose";
import type request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import { CHECKOUT_DESTINATION, resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { resetCouponFixtureCounter, seedCoupon } from "../helpers/coupon-fixtures.js";

const app = buildApp();

let seedCounter = 0;

async function seedProduct(price = 50000) {
  seedCounter += 1;
  const category = await Category.create({ name: `Cat OC${seedCounter}`, slug: `cat-oc${seedCounter}` });
  const product = await Product.create({
    name: `Producto OC${seedCounter}`,
    slug: `producto-oc${seedCounter}`,
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      { sku: `SKU-OC${seedCounter}`, name: "Variante", price, weightGrams: 200, dimensionsCm: { length: 10, width: 10, height: 10 }, isActive: true },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand: 10, reserved: 0 });
  return variant._id.toString();
}

type Agent = ReturnType<typeof request.agent>;

async function quote(agent: Agent, variantId: string, quantity = 2) {
  const lines = [{ itemType: "product", itemId: variantId, quantity }];
  const res = await agent.post("/api/v1/shipping/quotes").send({ destination: CHECKOUT_DESTINATION, lines });
  return { lines, quoteId: res.body.data.id as string, rateId: res.body.data.rates[0].rateId as string };
}

function placeOrder(agent: Agent, body: Record<string, unknown>) {
  return agent.post("/api/v1/orders").set("Idempotency-Key", randomUUID()).send({ paymentMethod: "card", termsAccepted: true, ...body });
}

describe("routes — POST /orders con cupón", () => {
  beforeEach(() => {
    seedCounter = 0;
    resetCheckoutFixtureCounter();
    resetCouponFixtureCounter();
  });

  it("aplica el cupón: el pedido trae descuento, total y el código aplicado", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ percentOff: 10 });
    const payload = await quote(agent, variantId);

    const res = await placeOrder(agent, { ...payload, couponCode: coupon.code });

    expect(res.status).toBe(201);
    const { order } = res.body.data;
    expect(order.totals.discountCents).toBe(10000);
    expect(order.totals.totalCents).toBe(order.totals.subtotalCents - 10000 + order.totals.shippingCents);
    expect(order.coupon).toEqual({ code: coupon.code });
  });

  it("acepta el código en minúsculas y con espacios", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon();
    const payload = await quote(agent, variantId);

    const res = await placeOrder(agent, { ...payload, couponCode: `  ${coupon.code.toLowerCase()} ` });

    expect(res.status).toBe(201);
    expect(res.body.data.order.coupon.code).toBe(coupon.code);
  });

  it("un código vacío se trata como sin cupón", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const payload = await quote(agent, variantId);

    const res = await placeOrder(agent, { ...payload, couponCode: "" });

    expect(res.status).toBe(201);
    expect(res.body.data.order.coupon).toBeUndefined();
    expect(res.body.data.order.totals.discountCents).toBe(0);
  });

  it("el cliente nunca manda montos: descuento y total mandados a mano se ignoran", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ percentOff: 10 });
    const payload = await quote(agent, variantId);

    const res = await placeOrder(agent, { ...payload, couponCode: coupon.code, discountCents: 99999, totalCents: 1, percentOff: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.order.totals.discountCents).toBe(10000);
    expect(res.body.data.order.totals.totalCents).toBeGreaterThan(1000);
  });

  it("un código que no existe trae COUPON_INVALID", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const payload = await quote(agent, variantId);

    const res = await placeOrder(agent, { ...payload, couponCode: "NOEXISTE" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.COUPON_INVALID);
  });

  it("un cupón vencido trae COUPON_EXPIRED", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ endsAt: new Date(Date.now() - 60_000) });
    const payload = await quote(agent, variantId);

    const res = await placeOrder(agent, { ...payload, couponCode: coupon.code });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.COUPON_EXPIRED);
  });

  it("un cupón personal de otra clienta trae COUPON_INVALID, igual que uno inexistente", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ kind: CouponKind.PERSONAL, assignedUserId: new Types.ObjectId(), maxCustomers: 1 });
    const payload = await quote(agent, variantId);

    const res = await placeOrder(agent, { ...payload, couponCode: coupon.code });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.COUPON_INVALID);
  });

  it("un cupón agotado trae COUPON_EXHAUSTED", async () => {
    const variantId = await seedProduct();
    const { agent: first } = await createCustomerSession(app);
    const { agent: second } = await createCustomerSession(app);
    const coupon = await seedCoupon({ maxCustomers: 1 });
    const firstPayload = await quote(first, variantId);
    expect((await placeOrder(first, { ...firstPayload, couponCode: coupon.code })).status).toBe(201);
    const secondPayload = await quote(second, variantId);

    const res = await placeOrder(second, { ...secondPayload, couponCode: coupon.code });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.COUPON_EXHAUSTED);
  });

  it("el pedido consultado después sigue mostrando el cupón aplicado", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon();
    const payload = await quote(agent, variantId);
    const created = await placeOrder(agent, { ...payload, couponCode: coupon.code });

    const res = await agent.get(`/api/v1/orders/${created.body.data.order.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.coupon).toEqual({ code: coupon.code });
    expect(res.body.data.totals.discountCents).toBe(10000);
  });
});
