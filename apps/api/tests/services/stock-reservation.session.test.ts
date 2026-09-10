import mongoose from "mongoose";
import { InventoryAction, ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { AppError } from "../../src/utils/app-error.js";
import { withTransaction } from "../../src/utils/with-transaction.js";
import {
  commitReservationDetailed,
  releaseReservationDetailed,
  reserveStock,
} from "../../src/services/stock-reservation.service.js";

/**
 * Estos tests verifican el gancho de composición transaccional que 1.5
 * necesita: `session?` en las funciones de reserva, y que los efectos no-DB
 * (auditoría, logs) los ejecute el DUEÑO de la transacción, nunca el
 * callee cuando corre dentro de una sesión ajena (ver plan de 1.5 §A).
 */

let seedCounter = 0;

async function seedVariant(opts: { onHand?: number; reserved?: number } = {}) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat S${suffix}`, slug: `cat-s${suffix}` });
  const variantId = new mongoose.Types.ObjectId();
  const sku = `SKU-S${suffix}`;

  const product = await Product.create({
    name: `Producto S${suffix}`,
    slug: `producto-s${suffix}`,
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

describe("services/stock-reservation — composición transaccional", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  it("reserveStock(input, session) participa de la transacción del caller: si el caller aborta después, el stock vuelve a 0", async () => {
    const { variantId } = await seedVariant({ onHand: 5 });

    await expect(
      withTransaction(async (session) => {
        await reserveStock(
          { cartRef: "cart-compose-1", lines: [{ variantId: variantId.toString(), quantity: 3 }], ttlMinutes: 30 },
          session,
        );
        throw new AppError("aborto deliberado del caller", 400);
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);
    expect(await StockReservation.countDocuments({ cartRef: "cart-compose-1" })).toBe(0);
  });

  it("commitReservationDetailed devuelve outcome 'committed' en una reserva activa", async () => {
    const { variantId } = await seedVariant({ onHand: 5 });
    const reservation = await reserveStock({
      cartRef: "cart-compose-2",
      lines: [{ variantId: variantId.toString(), quantity: 2 }],
      ttlMinutes: 30,
    });

    const result = await commitReservationDetailed(reservation._id.toString());
    expect(result.outcome).toBe("committed");
    expect(result.transitioned).toBe(true);
  });

  it("commitReservationDetailed devuelve 'already_committed' en una segunda llamada, sin lanzar", async () => {
    const { variantId } = await seedVariant({ onHand: 5 });
    const reservation = await reserveStock({
      cartRef: "cart-compose-3",
      lines: [{ variantId: variantId.toString(), quantity: 2 }],
      ttlMinutes: 30,
    });

    await commitReservationDetailed(reservation._id.toString());
    const second = await commitReservationDetailed(reservation._id.toString());
    expect(second.outcome).toBe("already_committed");
    expect(second.transitioned).toBe(false);
  });

  it("commitReservationDetailed devuelve 'already_released' EN VEZ DE LANZAR cuando se le pasa una sesión — nunca aborta la transacción del caller", async () => {
    const { variantId } = await seedVariant({ onHand: 5 });
    const reservation = await reserveStock({
      cartRef: "cart-compose-4",
      lines: [{ variantId: variantId.toString(), quantity: 2 }],
      ttlMinutes: 30,
    });
    await releaseReservationDetailed(reservation._id.toString());

    // Simula markOrderPaid: el commit corre DENTRO de la transacción del
    // caller. Si commitReservationDetailed lanzara aquí, abortaría también
    // la escritura de la orden — exactamente el bug que 1.5 corrige.
    const outcome = await withTransaction(async (session) => {
      const result = await commitReservationDetailed(reservation._id.toString(), session);
      // El caller sigue escribiendo en la MISMA transacción sin problema:
      await Inventory.updateOne({ variantId }, { $set: { sku: (await Inventory.findOne({ variantId }))!.sku } }, { session });
      return result;
    });

    expect(outcome.outcome).toBe("already_released");
    expect(outcome.transitioned).toBe(false);
  });

  it("commitReservation (wrapper) sigue lanzando 409 para already_released, preservando el contrato de 1.4", async () => {
    const { variantId } = await seedVariant({ onHand: 5 });
    const reservation = await reserveStock({
      cartRef: "cart-compose-5",
      lines: [{ variantId: variantId.toString(), quantity: 2 }],
      ttlMinutes: 30,
    });
    await releaseReservationDetailed(reservation._id.toString());

    const { commitReservation } = await import("../../src/services/stock-reservation.service.js");
    await expect(commitReservation(reservation._id.toString())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("no se audita release-mismatch cuando releaseReservationDetailed corre con una sesión ajena — el dueño de la transacción decide auditar", async () => {
    const { variantId } = await seedVariant({ onHand: 5, reserved: 1 });
    // Forzar una inconsistencia: reserva de 2 unidades pero solo hay 1 reservada de verdad.
    const reservation = await reserveStock({
      cartRef: "cart-compose-6",
      lines: [{ variantId: variantId.toString(), quantity: 2 }],
      ttlMinutes: 30,
    });
    // Desalinear manualmente el inventario para simular la inconsistencia.
    await Inventory.updateOne({ variantId }, { $set: { reserved: 1 } });

    await withTransaction(async (session) => {
      await releaseReservationDetailed(reservation._id.toString(), session);
    });

    const auditCount = await AuditLog.countDocuments({ action: InventoryAction.RELEASE_INVENTORY_MISMATCH });
    expect(auditCount).toBe(0);
  });
});
