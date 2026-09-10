import mongoose from "mongoose";
import { ProductStatus, ReservationStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { adjustStock } from "../../src/services/inventory.service.js";
import { commitReservation, releaseReservation, reserveStock } from "../../src/services/stock-reservation.service.js";

/**
 * Suite de contención real contra Mongo en memoria (replica set de un nodo,
 * ver tests/setup.ts). Todas las aserciones son sobre INVARIANTES, nunca
 * sobre orden o timing: quién gana una carrera es no determinista por
 * diseño; cuántos ganan, no. `Promise.allSettled` en vez de `Promise.all`
 * porque este último corta en el primer reject y pierde la evidencia que
 * necesitamos inspeccionar.
 *
 * Cobertura que esta suite NO da: un replica set de un nodo reproduce los
 * `WriteConflict` reales de WiredTiger, pero no latencia de red ni un
 * `UnknownTransactionCommitResult` de failover real.
 */

let seedCounter = 0;

async function seedVariant(onHand: number) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat ${suffix}`, slug: `cat-${suffix}` });
  const variantId = new mongoose.Types.ObjectId();
  const sku = `SKU-${suffix}`;

  const product = await Product.create({
    name: `Producto ${suffix}`,
    slug: `producto-${suffix}`,
    description: "Descripción de prueba",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        _id: variantId,
        sku,
        name: "Variante única",
        price: 1000,
        weightGrams: 100,
        dimensionsCm: { length: 1, width: 1, height: 1 },
        isActive: true,
      },
    ],
  });

  await Inventory.create({ productId: product._id, variantId, sku, onHand, reserved: 0 });
  return { productId: product._id, variantId, sku };
}

async function sumActiveReservedFor(variantId: mongoose.Types.ObjectId): Promise<number> {
  const active = await StockReservation.find({
    status: ReservationStatus.ACTIVE,
    "lines.variantId": variantId,
  }).lean();

  let total = 0;
  for (const reservation of active) {
    for (const line of reservation.lines) {
      if (line.variantId.toString() === variantId.toString()) total += line.quantity;
    }
  }
  return total;
}

describe("services/stock-reservation — concurrencia real", () => {
  it("sobreventa clásica: onHand=5, 10 reservas de 1 en paralelo -> exactamente 5 ganan", async () => {
    const { variantId } = await seedVariant(5);

    const attempts = Array.from({ length: 10 }, (_, i) =>
      reserveStock({
        cartRef: `cart-race-${i}`,
        lines: [{ variantId: variantId.toString(), quantity: 1 }],
        ttlMinutes: 30,
      }),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(5);
    expect(rejected).toHaveLength(5);
    expect(rejected.every((r) => (r as PromiseRejectedResult).reason.statusCode === 409)).toBe(true);

    const row = await Inventory.findOne({ variantId });
    expect(row?.onHand).toBe(5);
    expect(row?.reserved).toBe(5);
    expect(row!.onHand - row!.reserved).toBe(0);

    // La aserción asesina: un read-then-write puede dejar `reserved` alto sin
    // que existan las reservas que lo respaldan (o viceversa). Esta igualdad
    // cruzada entre colecciones es la única forma de detectar ambos casos.
    const sumLines = await sumActiveReservedFor(variantId);
    expect(sumLines).toBe(row?.reserved);
  }, 30_000);

  it("reparto exacto con cantidades distintas: onHand=10, 8 reservas de 3 -> exactamente 3 ganan", async () => {
    const { variantId } = await seedVariant(10);

    const attempts = Array.from({ length: 8 }, (_, i) =>
      reserveStock({
        cartRef: `cart-qty-${i}`,
        lines: [{ variantId: variantId.toString(), quantity: 3 }],
        ttlMinutes: 30,
      }),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(3);
    // Ningún 500: cualquier WriteConflict que se escape sin traducir rompe esto.
    expect(rejected.every((r) => r.reason.statusCode === 409)).toBe(true);

    const row = await Inventory.findOne({ variantId });
    expect(row?.reserved).toBe(9);
  }, 30_000);

  it("doble webhook en paralelo: commit x2 simultáneos descuenta onHand una sola vez", async () => {
    const { variantId } = await seedVariant(10);
    const reservation = await reserveStock({
      cartRef: "cart-double-commit",
      lines: [{ variantId: variantId.toString(), quantity: 4 }],
      ttlMinutes: 30,
    });

    const results = await Promise.allSettled([
      commitReservation(reservation._id.toString()),
      commitReservation(reservation._id.toString()),
    ]);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const row = await Inventory.findOne({ variantId });
    expect(row?.onHand).toBe(6);
    expect(row?.reserved).toBe(0);
  }, 30_000);

  it("commit vs release en carrera: gana exactamente uno, nunca un 500", async () => {
    const { variantId } = await seedVariant(10);
    const reservation = await reserveStock({
      cartRef: "cart-commit-vs-release",
      lines: [{ variantId: variantId.toString(), quantity: 4 }],
      ttlMinutes: 30,
    });

    const results = await Promise.allSettled([
      commitReservation(reservation._id.toString()),
      releaseReservation(reservation._id.toString()),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason.statusCode).toBe(409);

    const row = await Inventory.findOne({ variantId });
    expect(row!.reserved).toBe(0);
    expect(row!.onHand === 6 || row!.onHand === 10).toBe(true);
  }, 30_000);

  it("contención cruzada A/B con orden de líneas alternado -> cero respuestas >=500 e invariantes finales", async () => {
    const a = await seedVariant(20);
    const b = await seedVariant(20);

    const attempts = Array.from({ length: 20 }, (_, i) => {
      const lines =
        i % 2 === 0
          ? [
              { variantId: a.variantId.toString(), quantity: 2 },
              { variantId: b.variantId.toString(), quantity: 2 },
            ]
          : [
              { variantId: b.variantId.toString(), quantity: 2 },
              { variantId: a.variantId.toString(), quantity: 2 },
            ];
      return reserveStock({ cartRef: `cart-cross-${i}`, lines, ttlMinutes: 30 });
    });

    const results = await Promise.allSettled(attempts);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected.filter((r) => (r.reason.statusCode ?? 500) >= 500)).toHaveLength(0);

    const rowA = await Inventory.findOne({ variantId: a.variantId });
    const rowB = await Inventory.findOne({ variantId: b.variantId });
    expect(rowA!.onHand - rowA!.reserved).toBeGreaterThanOrEqual(0);
    expect(rowB!.onHand - rowB!.reserved).toBeGreaterThanOrEqual(0);
    expect(await sumActiveReservedFor(a.variantId)).toBe(rowA?.reserved);
    expect(await sumActiveReservedFor(b.variantId)).toBe(rowB?.reserved);
  }, 30_000);

  it("ajuste manual vs reserva en paralelo: gana uno, invariantes intactas en ambos desenlaces", async () => {
    const { variantId } = await seedVariant(5);

    const results = await Promise.allSettled([
      adjustStock({ variantId: variantId.toString(), delta: -5 }),
      reserveStock({
        cartRef: "cart-adjust-vs-reserve",
        lines: [{ variantId: variantId.toString(), quantity: 5 }],
        ttlMinutes: 30,
      }),
    ]);

    expect(results.some((r) => r.status === "fulfilled")).toBe(true);

    const row = await Inventory.findOne({ variantId });
    expect(row!.reserved).toBeLessThanOrEqual(row!.onHand);
    expect(row!.onHand).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
