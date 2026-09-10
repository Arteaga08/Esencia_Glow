import mongoose from "mongoose";
import { ProductStatus, ReservationStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { releaseExpiredReservations } from "../../src/jobs/release-expired-reservations.js";
import { commitReservation, reserveStock } from "../../src/services/stock-reservation.service.js";

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

/** Crea una reserva y luego le fuerza `expiresAt` al pasado sin pasar por el service. */
async function seedExpiredReservation(variantId: mongoose.Types.ObjectId, quantity: number, cartRef: string) {
  const reservation = await reserveStock({ cartRef, lines: [{ variantId: variantId.toString(), quantity }], ttlMinutes: 30 });
  await StockReservation.updateOne({ _id: reservation._id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
  return reservation;
}

describe("jobs/releaseExpiredReservations", () => {
  it("libera una reserva vencida y devuelve el stock", async () => {
    const { variantId } = await seedVariant(10);
    await seedExpiredReservation(variantId, 4, "cart-expired-1");

    const summary = await releaseExpiredReservations();

    expect(summary.released).toBe(1);
    const row = await Inventory.findOne({ variantId });
    expect(row?.reserved).toBe(0);
    const reservation = await StockReservation.findOne({ cartRef: "cart-expired-1" });
    expect(reservation?.status).toBe(ReservationStatus.RELEASED);
    expect(reservation?.purgeAt).toBeDefined();
  });

  it("no toca una reserva activa cuyo expiresAt sigue en el futuro", async () => {
    const { variantId } = await seedVariant(10);
    await reserveStock({ cartRef: "cart-future", lines: [{ variantId: variantId.toString(), quantity: 4 }], ttlMinutes: 30 });

    const summary = await releaseExpiredReservations();

    expect(summary.released).toBe(0);
    const row = await Inventory.findOne({ variantId });
    expect(row?.reserved).toBe(4);
  });

  it("no toca una reserva ya committed aunque su expiresAt haya pasado (no devuelve stock ya vendido)", async () => {
    const { variantId } = await seedVariant(10);
    const reservation = await reserveStock({
      cartRef: "cart-committed-expired",
      lines: [{ variantId: variantId.toString(), quantity: 4 }],
      ttlMinutes: 30,
    });
    await commitReservation(reservation._id.toString());
    await StockReservation.updateOne({ _id: reservation._id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });

    const summary = await releaseExpiredReservations();

    expect(summary.released).toBe(0);
    const row = await Inventory.findOne({ variantId });
    expect(row?.onHand).toBe(6);
    expect(row?.reserved).toBe(0);
  });

  it("respeta el tamaño de lote (sweepBatchSize)", async () => {
    const { variantId } = await seedVariant(100);
    for (let i = 0; i < 5; i += 1) {
      await seedExpiredReservation(variantId, 1, `cart-batch-${i}`);
    }

    const summary = await releaseExpiredReservations(undefined, 2);

    expect(summary.scanned).toBe(2);
    expect(summary.released).toBe(2);
  });

  it("dos ejecuciones simultáneas liberan cada reserva exactamente una vez", async () => {
    const { variantId } = await seedVariant(100);
    for (let i = 0; i < 10; i += 1) {
      await seedExpiredReservation(variantId, 1, `cart-parallel-${i}`);
    }

    const [summaryA, summaryB] = await Promise.all([
      releaseExpiredReservations(),
      releaseExpiredReservations(),
    ]);

    expect(summaryA.released + summaryB.released).toBe(10);
    const row = await Inventory.findOne({ variantId });
    expect(row?.reserved).toBe(0);
    const releasedCount = await StockReservation.countDocuments({ status: ReservationStatus.RELEASED });
    expect(releasedCount).toBe(10);
  });

  it("una reserva cuya fila de Inventory ya no existe igual se marca released", async () => {
    const { variantId } = await seedVariant(10);
    await seedExpiredReservation(variantId, 4, "cart-orphan");
    await Inventory.deleteOne({ variantId });

    const summary = await releaseExpiredReservations();

    expect(summary.released).toBe(1);
    const reservation = await StockReservation.findOne({ cartRef: "cart-orphan" });
    expect(reservation?.status).toBe(ReservationStatus.RELEASED);
  });
});
