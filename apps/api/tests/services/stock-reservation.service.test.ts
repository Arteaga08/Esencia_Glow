import mongoose from "mongoose";
import { InventoryAction, MAX_LINE_QUANTITY, ProductStatus, ReservationStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import {
  commitReservation,
  releaseReservation,
  reserveStock,
} from "../../src/services/stock-reservation.service.js";

let seedCounter = 0;

async function seedVariant(
  opts: {
    onHand?: number;
    reserved?: number;
    isActive?: boolean;
    productStatus?: ProductStatus;
  } = {},
) {
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
    status: opts.productStatus ?? ProductStatus.ACTIVE,
    variants: [
      {
        _id: variantId,
        sku,
        name: "Variante única",
        price: 1000,
        weightGrams: 100,
        dimensionsCm: { length: 1, width: 1, height: 1 },
        isActive: opts.isActive ?? true,
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

describe("services/stock-reservation", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  describe("reserveStock", () => {
    it("rechaza una línea que excede MAX_LINE_QUANTITY, sin tocar el inventario", async () => {
      const { variantId } = await seedVariant({ onHand: 10_000 });

      await expect(
        reserveStock({
          cartRef: "cart-cap-1",
          lines: [{ variantId: variantId.toString(), quantity: MAX_LINE_QUANTITY + 1 }],
          ttlMinutes: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      const row = await Inventory.findOne({ variantId });
      expect(row?.reserved).toBe(0);
    });

    it("aplica el tope sobre la cantidad YA fusionada de líneas duplicadas, no por línea cruda", async () => {
      const { variantId } = await seedVariant({ onHand: 10_000 });
      const half = Math.ceil(MAX_LINE_QUANTITY / 2) + 1;

      await expect(
        reserveStock({
          cartRef: "cart-cap-2",
          lines: [
            { variantId: variantId.toString(), quantity: half },
            { variantId: variantId.toString(), quantity: half },
          ],
          ttlMinutes: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("sube reserved sin mover onHand y deja purgeAt sin definir", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });

      const reservation = await reserveStock({
        cartRef: "cart-1",
        lines: [{ variantId: variantId.toString(), quantity: 3 }],
        ttlMinutes: 30,
      });

      expect(reservation.status).toBe(ReservationStatus.ACTIVE);
      expect(reservation.purgeAt).toBeUndefined();
      expect(reservation.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(10);
      expect(row?.reserved).toBe(3);
    });

    it("responde 409 sin stock suficiente y no muta el inventario", async () => {
      const { variantId } = await seedVariant({ onHand: 2 });

      await expect(
        reserveStock({
          cartRef: "cart-2",
          lines: [{ variantId: variantId.toString(), quantity: 5 }],
          ttlMinutes: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const row = await Inventory.findOne({ variantId });
      expect(row?.reserved).toBe(0);
    });

    it("multi-línea: si la segunda no alcanza, revierte todo (ninguna reserva parcial)", async () => {
      const first = await seedVariant({ onHand: 10 });
      const second = await seedVariant({ onHand: 1 });

      await expect(
        reserveStock({
          cartRef: "cart-3",
          lines: [
            { variantId: first.variantId.toString(), quantity: 5 },
            { variantId: second.variantId.toString(), quantity: 5 },
          ],
          ttlMinutes: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const firstRow = await Inventory.findOne({ variantId: first.variantId });
      const secondRow = await Inventory.findOne({ variantId: second.variantId });
      expect(firstRow?.reserved).toBe(0);
      expect(secondRow?.reserved).toBe(0);
      expect(await StockReservation.countDocuments({ cartRef: "cart-3" })).toBe(0);
    });

    it("dos líneas de la misma variante se agregan en una sola con la cantidad sumada", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });

      const reservation = await reserveStock({
        cartRef: "cart-4",
        lines: [
          { variantId: variantId.toString(), quantity: 2 },
          { variantId: variantId.toString(), quantity: 3 },
        ],
        ttlMinutes: 30,
      });

      expect(reservation.lines).toHaveLength(1);
      expect(reservation.lines[0]?.quantity).toBe(5);

      const row = await Inventory.findOne({ variantId });
      expect(row?.reserved).toBe(5);
    });

    it("rechaza reservar una variante inactiva", async () => {
      const { variantId } = await seedVariant({ onHand: 10, isActive: false });

      await expect(
        reserveStock({
          cartRef: "cart-5",
          lines: [{ variantId: variantId.toString(), quantity: 1 }],
          ttlMinutes: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const row = await Inventory.findOne({ variantId });
      expect(row?.reserved).toBe(0);
    });

    it("rechaza reservar una variante de un producto archivado", async () => {
      const { variantId } = await seedVariant({ onHand: 10, productStatus: ProductStatus.ARCHIVED });

      await expect(
        reserveStock({
          cartRef: "cart-6",
          lines: [{ variantId: variantId.toString(), quantity: 1 }],
          ttlMinutes: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("una segunda reserva activa para el mismo cartRef responde 409", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      await reserveStock({
        cartRef: "cart-7",
        lines: [{ variantId: variantId.toString(), quantity: 1 }],
        ttlMinutes: 30,
      });

      await expect(
        reserveStock({
          cartRef: "cart-7",
          lines: [{ variantId: variantId.toString(), quantity: 1 }],
          ttlMinutes: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("commitReservation / releaseReservation", () => {
    it("commit baja onHand y reserved, deja status committed y purgeAt definido", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      const reservation = await reserveStock({
        cartRef: "cart-8",
        lines: [{ variantId: variantId.toString(), quantity: 4 }],
        ttlMinutes: 30,
      });

      const committed = await commitReservation(reservation._id.toString());

      expect(committed.status).toBe(ReservationStatus.COMMITTED);
      expect(committed.purgeAt).toBeDefined();
      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(6);
      expect(row?.reserved).toBe(0);
    });

    it("release baja reserved y deja onHand intacto, con purgeAt definido", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      const reservation = await reserveStock({
        cartRef: "cart-9",
        lines: [{ variantId: variantId.toString(), quantity: 4 }],
        ttlMinutes: 30,
      });

      const released = await releaseReservation(reservation._id.toString());

      expect(released.status).toBe(ReservationStatus.RELEASED);
      expect(released.purgeAt).toBeDefined();
      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(10);
      expect(row?.reserved).toBe(0);
    });

    it("commit dos veces en serie es idempotente y no vuelve a mover contadores", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      const reservation = await reserveStock({
        cartRef: "cart-10",
        lines: [{ variantId: variantId.toString(), quantity: 4 }],
        ttlMinutes: 30,
      });

      await commitReservation(reservation._id.toString());
      const second = await commitReservation(reservation._id.toString());

      expect(second.status).toBe(ReservationStatus.COMMITTED);
      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(6);
      expect(row?.reserved).toBe(0);
    });

    it("release dos veces en serie es idempotente", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      const reservation = await reserveStock({
        cartRef: "cart-11",
        lines: [{ variantId: variantId.toString(), quantity: 4 }],
        ttlMinutes: 30,
      });

      await releaseReservation(reservation._id.toString());
      const second = await releaseReservation(reservation._id.toString());

      expect(second.status).toBe(ReservationStatus.RELEASED);
      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(10);
      expect(row?.reserved).toBe(0);
    });

    it("commit sobre una reserva ya released responde con error dedicado y no toca onHand", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      const reservation = await reserveStock({
        cartRef: "cart-12",
        lines: [{ variantId: variantId.toString(), quantity: 4 }],
        ttlMinutes: 30,
      });
      await releaseReservation(reservation._id.toString());

      await expect(commitReservation(reservation._id.toString())).rejects.toMatchObject({
        statusCode: 409,
      });

      const row = await Inventory.findOne({ variantId });
      expect(row?.onHand).toBe(10);
    });

    it("release con Inventory.reserved ya por debajo de lo esperado audita la inconsistencia y aun así marca released", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      const reservation = await reserveStock({
        cartRef: "cart-mismatch",
        lines: [{ variantId: variantId.toString(), quantity: 4 }],
        ttlMinutes: 30,
      });
      // Simula una inconsistencia externa: algo dejó `reserved` por debajo de
      // lo que esta reserva cree haber apartado.
      await Inventory.updateOne({ variantId }, { $set: { reserved: 1 } });

      const released = await releaseReservation(reservation._id.toString());

      expect(released.status).toBe(ReservationStatus.RELEASED);
      const entry = await AuditLog.findOne({ action: InventoryAction.RELEASE_INVENTORY_MISMATCH });
      expect(entry).not.toBeNull();
      expect(entry?.metadata).toMatchObject({ reservationId: reservation._id.toString() });
    });

    it("release sobre una reserva ya committed responde 409", async () => {
      const { variantId } = await seedVariant({ onHand: 10 });
      const reservation = await reserveStock({
        cartRef: "cart-13",
        lines: [{ variantId: variantId.toString(), quantity: 4 }],
        ttlMinutes: 30,
      });
      await commitReservation(reservation._id.toString());

      await expect(releaseReservation(reservation._id.toString())).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("commit y release de un id inexistente responden 404", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(commitReservation(fakeId)).rejects.toMatchObject({ statusCode: 404 });
      await expect(releaseReservation(fakeId)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
