import { randomUUID } from "node:crypto";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createOrder } from "../../src/services/order.service.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

/**
 * Idempotencia y concurrencia del checkout (plan de 1.5 §B-C). El caso que
 * más importa: `Promise.allSettled` de varios `createOrder` concurrentes
 * con la MISMA idempotency key debe producir UNA sola orden y UN solo
 * `$inc reserved` — nunca dos reservas por un doble-click o un reintento de
 * red del cliente.
 */

describe("services/order — idempotencia y concurrencia", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("un replay con la misma key y el mismo payload devuelve la orden existente (replay: true)", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines);

    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(first.replay).toBe(false);
    expect(second.replay).toBe(true);
    expect(second.order._id.toString()).toBe(first.order._id.toString());
    expect(await Order.countDocuments({ userId })).toBe(1);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(1);
  });

  it("la misma key con un payload distinto responde 409 y no toca la orden original", async () => {
    const { variantId: variantA } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const { variantId: variantB } = await seedVariantWithStock({ price: 30000, onHand: 10 });
    const userId = randomUserId();
    const key = randomUUID();

    const inputA = await buildCreateOrderInput(
      userId,
      [{ itemType: "product", itemId: variantA.toString(), quantity: 1 }],
      { idempotencyKey: key },
    );
    const { order: orderA } = await createOrder(inputA);

    const inputB = await buildCreateOrderInput(
      userId,
      [{ itemType: "product", itemId: variantB.toString(), quantity: 1 }],
      { idempotencyKey: key },
    );

    await expect(createOrder(inputB)).rejects.toMatchObject({ statusCode: 409 });

    const reloaded = await Order.findById(orderA._id);
    expect(reloaded!.lines[0]!.sku).toBe(orderA.lines[0]!.sku);
    expect(await Order.countDocuments({ userId })).toBe(1);
  });

  it("misma key, usuarios distintos: dos órdenes independientes", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const key = randomUUID();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];

    const userA = randomUserId();
    const userB = randomUserId();
    const inputA = await buildCreateOrderInput(userA, lines, { idempotencyKey: key });
    const inputB = await buildCreateOrderInput(userB, lines, { idempotencyKey: key });

    const resultA = await createOrder(inputA);
    const resultB = await createOrder(inputB);

    expect(resultA.replay).toBe(false);
    expect(resultB.replay).toBe(false);
    expect(resultA.order._id.toString()).not.toBe(resultB.order._id.toString());
  });

  it("un segundo checkout (key distinta) mientras el primero sigue pending responde 409 con el orderId existente", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];

    const firstInput = await buildCreateOrderInput(userId, lines);
    const { order: firstOrder } = await createOrder(firstInput);

    const secondInput = await buildCreateOrderInput(userId, lines);

    await expect(createOrder(secondInput)).rejects.toMatchObject({
      statusCode: 409,
      errors: { orderId: firstOrder._id.toString() },
    });
  });

  it("checkout fallido por falta de stock no consume la idempotency key: reintentar con la misma key funciona", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 1 });
    const userId = randomUserId();
    const key = randomUUID();
    const shortLines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 5 }];

    const failingInput = await buildCreateOrderInput(userId, shortLines, { idempotencyKey: key });
    await expect(createOrder(failingInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(await Order.countDocuments({ userId })).toBe(0);

    const okLines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const retryInput = await buildCreateOrderInput(userId, okLines, { idempotencyKey: key });
    const { replay } = await createOrder(retryInput);

    expect(replay).toBe(false);
    expect(await Order.countDocuments({ userId })).toBe(1);
  });

  it("🔀 cinco creates concurrentes con la misma key producen UNA sola orden y UN solo $inc reserved", async () => {
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const userId = randomUserId();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const input = await buildCreateOrderInput(userId, lines);

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => createOrder({ ...input })));

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Awaited<ReturnType<typeof createOrder>>
    >[];
    // Todas deben resolver (una crea, las demás son replay) — ninguna 409 real.
    expect(fulfilled).toHaveLength(5);

    const orderIds = new Set(fulfilled.map((r) => r.value.order._id.toString()));
    expect(orderIds.size).toBe(1);
    expect(fulfilled.filter((r) => r.value.replay === false)).toHaveLength(1);
    expect(fulfilled.filter((r) => r.value.replay === true)).toHaveLength(4);

    expect(await Order.countDocuments({ userId })).toBe(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(1);
  });
});
