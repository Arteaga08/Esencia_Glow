import mongoose from "mongoose";
import { ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { commitReservation, releaseReservation, reserveStock } from "../../src/services/stock-reservation.service.js";
import { restockCommittedReservation } from "../../src/services/reservation-restock.service.js";

/**
 * `restockCommittedReservation` devuelve las unidades comprometidas por un
 * reembolso a `Inventory.onHand`, SIN tocar `reserved` (el dinero ya se
 * devolvió, no hay nada "reservado" que liberar) — ver plan de 1.6.3 §3.
 */
let seedCounter = 0;

async function seedVariant(opts: { onHand?: number; reserved?: number } = {}) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat R${suffix}`, slug: `cat-r-${suffix}` });
  const variantId = new mongoose.Types.ObjectId();
  const sku = `SKU-R${suffix}`;

  const product = await Product.create({
    name: `Producto R${suffix}`,
    slug: `producto-r-${suffix}`,
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

  await Inventory.create({
    productId: product._id,
    variantId,
    sku,
    onHand: opts.onHand ?? 10,
    reserved: opts.reserved ?? 0,
  });

  return { productId: product._id, variantId, sku };
}

async function seedCommittedReservation(quantity = 2) {
  const { variantId, sku } = await seedVariant({ onHand: 10, reserved: 0 });
  const reservation = await reserveStock({
    cartRef: `cart-${seedCounter}`,
    lines: [{ variantId: variantId.toString(), quantity }],
    ttlMinutes: 30,
  });
  await commitReservation(reservation._id.toString());
  return { reservationId: reservation._id.toString(), variantId, sku, quantity };
}

describe("services/reservation-restock — restockCommittedReservation", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  it("reserva committed: onHand vuelve a subir, reserved queda intacto", async () => {
    const { reservationId, variantId, quantity } = await seedCommittedReservation(3);
    const inventoryBefore = await Inventory.findOne({ variantId }).lean();
    expect(inventoryBefore!.onHand).toBe(7); // 10 - 3 (commit descontó onHand y reserved)
    expect(inventoryBefore!.reserved).toBe(0);

    const result = await restockCommittedReservation(reservationId);

    expect(result.restocked).toBe(true);
    expect(result.missingVariants).toEqual([]);

    const inventoryAfter = await Inventory.findOne({ variantId }).lean();
    expect(inventoryAfter!.onHand).toBe(7 + quantity);
    expect(inventoryAfter!.reserved).toBe(0);

    const reservation = await StockReservation.findById(reservationId).lean();
    expect(reservation!.restockedAt).toBeInstanceOf(Date);
  });

  it("es idempotente: una segunda llamada no vuelve a sumar onHand", async () => {
    const { reservationId, variantId, quantity } = await seedCommittedReservation(4);
    await restockCommittedReservation(reservationId);
    const afterFirst = await Inventory.findOne({ variantId }).lean();

    const second = await restockCommittedReservation(reservationId);

    expect(second.restocked).toBe(false);
    const afterSecond = await Inventory.findOne({ variantId }).lean();
    expect(afterSecond!.onHand).toBe(afterFirst!.onHand);
    expect(afterSecond!.onHand).toBe(6 + quantity);
  });

  it("una reserva released (incidente de inventario) no se restockea", async () => {
    const { variantId } = await seedVariant({ onHand: 10, reserved: 0 });
    const reservation = await reserveStock({
      cartRef: `cart-released-${seedCounter}`,
      lines: [{ variantId: variantId.toString(), quantity: 2 }],
      ttlMinutes: 30,
    });
    await releaseReservation(reservation._id.toString());
    const inventoryBefore = await Inventory.findOne({ variantId }).lean();

    const result = await restockCommittedReservation(reservation._id.toString());

    expect(result.restocked).toBe(false);
    const inventoryAfter = await Inventory.findOne({ variantId }).lean();
    expect(inventoryAfter!.onHand).toBe(inventoryBefore!.onHand);
  });

  it("fila de inventario faltante: no lanza, la reporta en missingVariants", async () => {
    const { reservationId, variantId, sku } = await seedCommittedReservation(1);
    await Inventory.deleteOne({ variantId });

    const result = await restockCommittedReservation(reservationId);

    expect(result.restocked).toBe(true);
    expect(result.missingVariants).toEqual([{ variantId, sku }]);

    const reservation = await StockReservation.findById(reservationId).lean();
    expect(reservation!.restockedAt).toBeInstanceOf(Date);
  });
});
