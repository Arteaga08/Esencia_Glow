import { randomUUID } from "node:crypto";
import { CouponDiscountType, ErrorCode, OrderStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Coupon } from "../../src/models/coupon.model.js";
import { CouponUsage } from "../../src/models/coupon-usage.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Settings } from "../../src/models/settings.model.js";
import { AppError } from "../../src/utils/app-error.js";
import { createOrder } from "../../src/services/order.service.js";
import { closePendingOrder } from "../../src/services/order-closing.service.js";
import { cancelExpiredOrders } from "../../src/jobs/cancel-expired-orders.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildCreateOrderInput, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";
import { resetCouponFixtureCounter, seedCoupon, seedCustomer } from "../helpers/coupon-fixtures.js";

/**
 * Cupones en el checkout (Milestone 3.7): el canje vive DENTRO de la
 * transacción de `createOrder`, así que un pedido que no se crea no deja ni
 * un uso ni stock apartado, y uno cancelado o expirado devuelve su uso.
 */
describe("services/create-order — cupones", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
    resetCouponFixtureCounter();
  });

  async function setup(opts: { price?: number; onHand?: number } = {}) {
    const userId = await seedCustomer();
    const seeded = await seedVariantWithStock({ price: opts.price ?? 50000, onHand: opts.onHand ?? 10 });
    const lines = [{ itemType: "product" as const, itemId: seeded.variantId.toString(), quantity: 2 }];
    return { userId, lines, variantId: seeded.variantId };
  }

  async function failure(promise: Promise<unknown>): Promise<AppError> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      return error as AppError;
    }
    throw new Error("Se esperaba un error");
  }

  it("aplica el descuento, desglosa el IVA del total descontado y congela el cupón en el pedido", async () => {
    const { userId, lines } = await setup();
    const coupon = await seedCoupon({ percentOff: 10 });
    const input = await buildCreateOrderInput(userId, lines, { couponCode: coupon.code });

    const { order } = await createOrder(input);

    expect(order.subtotalCents).toBe(100000);
    expect(order.discountCents).toBe(10000);
    expect(order.totalCents).toBe(order.subtotalCents - order.discountCents + order.shippingCents);
    expect(order.subtotalCents - order.discountCents + order.shippingCents - order.taxCents).toBe(
      Math.round((order.totalCents * 10_000) / (10_000 + order.taxRateBps)),
    );
    expect(order.coupon?.code).toBe(coupon.code);
    expect(order.coupon?.couponId.toString()).toBe(coupon._id.toString());
    expect(order.coupon?.discountType).toBe(CouponDiscountType.PERCENT);
    expect(order.coupon?.percentOff).toBe(10);
    expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(1);
  });

  it("sin cupón el pedido queda igual que antes", async () => {
    const { userId, lines } = await setup();
    const { order } = await createOrder(await buildCreateOrderInput(userId, lines));
    expect(order.discountCents).toBe(0);
    expect(order.coupon).toBeUndefined();
  });

  it("un cupón inválido rechaza el pedido SIN apartar stock ni crear la orden", async () => {
    const { userId, lines, variantId } = await setup();
    const error = await failure(createOrder(await buildCreateOrderInput(userId, lines, { couponCode: "NOEXISTE" })));

    expect(error.code).toBe(ErrorCode.COUPON_INVALID);
    expect(await Order.countDocuments({ userId })).toBe(0);
    expect((await Inventory.findOne({ variantId }))?.reserved).toBe(0);
  });

  it("un descuento que dejaría el total por debajo de $10 se rechaza y no deja el canje tomado", async () => {
    const { userId, lines, variantId } = await setup({ price: 5000 });
    // Envío gratis desde $0.01 para que el total quede solo en el subtotal descontado.
    await Settings.findOneAndUpdate({ _id: "global" }, { $set: { "commerce.freeShippingThresholdCents": 1 } }, { upsert: true });
    const coupon = await seedCoupon({ percentOff: 100, maxCustomers: 3 });

    const error = await failure(createOrder(await buildCreateOrderInput(userId, lines, { couponCode: coupon.code })));

    expect(error.code).toBe(ErrorCode.COUPON_MIN_NOT_MET);
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(0);
    expect(await CouponUsage.countDocuments({ couponId: coupon._id })).toBe(0);
    expect((await Inventory.findOne({ variantId }))?.reserved).toBe(0);
  });

  it("replay con la misma llave y el mismo cupón devuelve el mismo pedido sin canjear otra vez", async () => {
    const { userId, lines } = await setup();
    const coupon = await seedCoupon();
    const input = await buildCreateOrderInput(userId, lines, { couponCode: coupon.code });

    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(second.replay).toBe(true);
    expect(second.order._id.toString()).toBe(first.order._id.toString());
    expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(1);
  });

  it("CONCURRENCIA: doble envío simultáneo con la misma llave y cupón → un solo pedido y un solo uso", async () => {
    const { userId, lines } = await setup();
    const coupon = await seedCoupon({ maxCustomers: 5 });
    const input = await buildCreateOrderInput(userId, lines, { couponCode: coupon.code });

    const results = await Promise.allSettled([createOrder(input), createOrder(input), createOrder(input)]);

    const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrder>>> => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(3);
    expect(new Set(fulfilled.map((result) => result.value.order._id.toString())).size).toBe(1);
    expect(await Order.countDocuments({ userId })).toBe(1);
    expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(1);
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
  });

  it("la misma llave con OTRO cupón no es un replay: 409", async () => {
    const { userId, lines } = await setup();
    const first = await seedCoupon();
    const other = await seedCoupon();
    const input = await buildCreateOrderInput(userId, lines, { couponCode: first.code });
    await createOrder(input);

    const error = await failure(createOrder({ ...input, couponCode: other.code }));

    expect(error.statusCode).toBe(409);
  });

  it("la misma llave sin cupón tras haber usado uno tampoco es un replay", async () => {
    const { userId, lines } = await setup();
    const coupon = await seedCoupon();
    const input = await buildCreateOrderInput(userId, lines, { couponCode: coupon.code });
    await createOrder(input);

    const withoutCoupon = { ...input };
    delete withoutCoupon.couponCode;
    const error = await failure(createOrder(withoutCoupon));

    expect(error.statusCode).toBe(409);
  });

  describe("liberación del uso", () => {
    it("cancelar el pedido pendiente devuelve el uso y el lugar de persona", async () => {
      const { userId, lines } = await setup();
      const coupon = await seedCoupon({ maxCustomers: 1 });
      const { order } = await createOrder(await buildCreateOrderInput(userId, lines, { couponCode: coupon.code }));

      const result = await closePendingOrder(order._id.toString(), "customer", { userId, provider: buildFakePaymentProvider() });

      expect(result.outcome).toBe("closed");
      expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(0);
      expect((await Coupon.findById(coupon._id))?.customersCount).toBe(0);
    });

    it("cerrar dos veces el mismo pedido libera una sola vez", async () => {
      const { userId, lines } = await setup();
      const coupon = await seedCoupon({ maxCustomers: 5, perCustomerLimit: 2 });
      const otherUser = await seedCustomer();
      const other = await seedVariantWithStock({ price: 50000, onHand: 10 });
      await createOrder(
        await buildCreateOrderInput(otherUser, [{ itemType: "product", itemId: other.variantId.toString(), quantity: 1 }], { couponCode: coupon.code }),
      );
      const { order } = await createOrder(await buildCreateOrderInput(userId, lines, { couponCode: coupon.code }));
      const provider = buildFakePaymentProvider();

      await Promise.all([
        closePendingOrder(order._id.toString(), "customer", { userId, provider }),
        closePendingOrder(order._id.toString(), "system", { provider }),
      ]);

      expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(0);
      // La otra clienta conserva su lugar: el contador bajó solo por la clienta que cerró.
      expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
    });

    it("el barrendero de pedidos vencidos devuelve el uso", async () => {
      const { userId, lines } = await setup();
      const coupon = await seedCoupon({ maxCustomers: 1 });
      const { order } = await createOrder(await buildCreateOrderInput(userId, lines, { couponCode: coupon.code }));
      await Order.updateOne({ _id: order._id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });

      const summary = await cancelExpiredOrders(new Date(), 100, buildFakePaymentProvider());

      expect(summary.cancelled).toBe(1);
      expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(0);
      expect((await Coupon.findById(coupon._id))?.customersCount).toBe(0);
    });

    it("tras liberar, otra clienta puede tomar el lugar del tope", async () => {
      const first = await setup();
      const second = await setup();
      const coupon = await seedCoupon({ maxCustomers: 1 });
      const { order } = await createOrder(await buildCreateOrderInput(first.userId, first.lines, { couponCode: coupon.code }));

      const blocked = await failure(createOrder(await buildCreateOrderInput(second.userId, second.lines, { couponCode: coupon.code })));
      expect(blocked.code).toBe(ErrorCode.COUPON_EXHAUSTED);

      await closePendingOrder(order._id.toString(), "customer", { userId: first.userId, provider: buildFakePaymentProvider() });

      const { order: secondOrder } = await createOrder(await buildCreateOrderInput(second.userId, second.lines, { couponCode: coupon.code }));
      expect(secondOrder.status).toBe(OrderStatus.PENDING);
    });
  });

  it("CONCURRENCIA: 4 clientas con checkout simultáneo sobre un tope de 2 → 2 pedidos y stock apartado solo para esos 2", async () => {
    const coupon = await seedCoupon({ maxCustomers: 2 });
    const buyers = await Promise.all(Array.from({ length: 4 }, () => setup()));
    const inputs = await Promise.all(
      buyers.map((buyer) => buildCreateOrderInput(buyer.userId, buyer.lines, { couponCode: coupon.code, idempotencyKey: randomUUID() })),
    );

    const results = await Promise.allSettled(inputs.map((input) => createOrder(input)));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    for (const result of results) {
      if (result.status === "rejected") expect((result.reason as AppError).code).toBe(ErrorCode.COUPON_EXHAUSTED);
    }
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(2);
    const reservedTotal = (await Inventory.find({ variantId: { $in: buyers.map((buyer) => buyer.variantId) } })).reduce(
      (sum, row) => sum + row.reserved,
      0,
    );
    expect(reservedTotal).toBe(2 * 2);
  });
});
