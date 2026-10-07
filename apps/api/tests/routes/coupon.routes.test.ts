import { CouponDiscountType, CouponKind, ErrorCode, ProductStatus } from "@esencia-glow/shared";
import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Coupon } from "../../src/models/coupon.model.js";
import { CouponUsage } from "../../src/models/coupon-usage.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { resetCouponFixtureCounter, seedCoupon } from "../helpers/coupon-fixtures.js";

const app = buildApp();

let seedCounter = 0;

async function seedProduct(price = 50000) {
  seedCounter += 1;
  const category = await Category.create({ name: `Cat CP${seedCounter}`, slug: `cat-cp${seedCounter}` });
  const product = await Product.create({
    name: `Producto CP${seedCounter}`,
    slug: `producto-cp${seedCounter}`,
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      { sku: `SKU-CP${seedCounter}`, name: "Variante", price, weightGrams: 200, dimensionsCm: { length: 10, width: 10, height: 10 }, isActive: true },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand: 10, reserved: 0 });
  return variant._id.toString();
}

function validate(agent: request.Agent, body: Record<string, unknown>) {
  return agent.post("/api/v1/coupons/validate").send(body);
}

describe("routes — POST /coupons/validate", () => {
  beforeEach(() => {
    seedCounter = 0;
    resetCheckoutFixtureCounter();
    resetCouponFixtureCounter();
  });

  it("exige sesión", async () => {
    const res = await request(app).post("/api/v1/coupons/validate").send({ code: "X", lines: [] });
    expect(res.status).toBe(401);
  });

  it("devuelve la vista previa: descuento calculado por el servidor y etiqueta lista", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ percentOff: 15 });

    const res = await validate(agent, { code: coupon.code, lines: [{ itemType: "product", itemId: variantId, quantity: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      code: coupon.code,
      discountType: CouponDiscountType.PERCENT,
      discountCents: 15000,
      label: "15% de descuento",
    });
  });

  it("monto fijo: etiqueta en pesos y descuento topado al subtotal", async () => {
    const variantId = await seedProduct(20000);
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ discountType: CouponDiscountType.FIXED, percentOff: undefined, amountOffCents: 50000 });

    const res = await validate(agent, { code: coupon.code, lines: [{ itemType: "product", itemId: variantId, quantity: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.discountCents).toBe(20000);
    expect(res.body.data.label).toBe("$500.00 de descuento");
  });

  it("acepta el código en minúsculas", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon();
    const res = await validate(agent, { code: coupon.code.toLowerCase(), lines: [{ itemType: "product", itemId: variantId, quantity: 1 }] });
    expect(res.status).toBe(200);
  });

  it("NO escribe nada: no toma lugar ni uso", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ maxCustomers: 2 });

    await validate(agent, { code: coupon.code, lines: [{ itemType: "product", itemId: variantId, quantity: 1 }] });

    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(0);
    expect(await CouponUsage.countDocuments({ couponId: coupon._id })).toBe(0);
  });

  it("inexistente, desactivado y personal ajeno responden lo mismo (no revela cuáles existen)", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const lines = [{ itemType: "product", itemId: variantId, quantity: 1 }];
    const inactive = await seedCoupon({ isActive: false });
    const foreign = await seedCoupon({ kind: CouponKind.PERSONAL, assignedUserId: new Types.ObjectId(), maxCustomers: 1 });

    const bodies = await Promise.all(["NOEXISTE", inactive.code, foreign.code].map((code) => validate(agent, { code, lines })));

    for (const res of bodies) {
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.COUPON_INVALID);
    }
    expect(new Set(bodies.map((res) => res.body.message)).size).toBe(1);
  });

  it("vencido, mínimo no alcanzado, agotado y ya usado traen su propio código", async () => {
    const variantId = await seedProduct();
    const { agent, userId } = await createCustomerSession(app);
    const lines = [{ itemType: "product", itemId: variantId, quantity: 1 }];

    const expired = await seedCoupon({ endsAt: new Date(Date.now() - 60_000) });
    expect((await validate(agent, { code: expired.code, lines })).body.code).toBe(ErrorCode.COUPON_EXPIRED);

    const withMinimum = await seedCoupon({ minSubtotalCents: 90000 });
    const minimum = await validate(agent, { code: withMinimum.code, lines });
    expect(minimum.body.code).toBe(ErrorCode.COUPON_MIN_NOT_MET);
    expect(minimum.body.message).toContain("$900.00");

    const full = await seedCoupon({ maxCustomers: 1, customersCount: 1 });
    expect((await validate(agent, { code: full.code, lines })).body.code).toBe(ErrorCode.COUPON_EXHAUSTED);

    const used = await seedCoupon({ maxCustomers: 5, customersCount: 1 });
    await CouponUsage.create({ couponId: used._id, userId, uses: 1 });
    expect((await validate(agent, { code: used.code, lines })).body.code).toBe(ErrorCode.COUPON_ALREADY_USED);
  });

  it("una clienta que ya lo tiene sigue viéndolo aunque el tope de personas esté lleno", async () => {
    const variantId = await seedProduct();
    const { agent, userId } = await createCustomerSession(app);
    const coupon = await seedCoupon({ maxCustomers: 1, customersCount: 1, perCustomerLimit: 2 });
    await CouponUsage.create({ couponId: coupon._id, userId, uses: 1 });

    const res = await validate(agent, { code: coupon.code, lines: [{ itemType: "product", itemId: variantId, quantity: 1 }] });

    expect(res.status).toBe(200);
  });

  it("ignora los montos que mande el cliente", async () => {
    const variantId = await seedProduct();
    const { agent } = await createCustomerSession(app);
    const coupon = await seedCoupon({ percentOff: 10 });

    const res = await validate(agent, {
      code: coupon.code,
      lines: [{ itemType: "product", itemId: variantId, quantity: 2 }],
      discountCents: 99999,
      subtotalCents: 1,
    });

    expect(res.body.data.discountCents).toBe(10000);
  });

  it("un carrito vacío o sin código es 400", async () => {
    const { agent } = await createCustomerSession(app);
    expect((await validate(agent, { code: "ABC1", lines: [] })).status).toBe(400);
    expect((await validate(agent, { lines: [{ itemType: "product", itemId: "665f1f77bcf86cd799439011", quantity: 1 }] })).status).toBe(400);
  });
});
