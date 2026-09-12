import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { ReservationStatus, StockStatus } from "@esencia-glow/shared";
import { buildAdminInventoryRow, buildAdminReservation } from "../../src/services/inventory-dto.js";

function objectId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId();
}

describe("services/inventory-dto", () => {
  describe("buildAdminInventoryRow", () => {
    it("resuelve el umbral efectivo y el status contra el default global cuando no hay override", () => {
      const row = buildAdminInventoryRow(
        { _id: objectId(), productId: objectId(), variantId: objectId(), sku: "SKU-1", onHand: 3, reserved: 0 },
        5,
      );

      expect(row.lowStockThreshold).toBeNull();
      expect(row.effectiveLowStockThreshold).toBe(5);
      expect(row.status).toBe(StockStatus.LOW);
      expect(row.lastRestockedAt).toBeNull();
    });

    it("usa el override del SKU sobre el default global", () => {
      const row = buildAdminInventoryRow(
        {
          _id: objectId(),
          productId: objectId(),
          variantId: objectId(),
          sku: "SKU-2",
          onHand: 8,
          reserved: 0,
          lowStockThreshold: 10,
        },
        5,
      );

      expect(row.lowStockThreshold).toBe(10);
      expect(row.effectiveLowStockThreshold).toBe(10);
      expect(row.status).toBe(StockStatus.LOW);
    });

    it("expone lastRestockedAt como ISO string cuando existe", () => {
      const date = new Date("2026-01-01T00:00:00.000Z");
      const row = buildAdminInventoryRow(
        { _id: objectId(), productId: objectId(), variantId: objectId(), sku: "SKU-3", onHand: 10, reserved: 0, lastRestockedAt: date },
        5,
      );

      expect(row.lastRestockedAt).toBe(date.toISOString());
    });
  });

  describe("buildAdminReservation", () => {
    it("expone committedAt/releasedAt como ISO string cuando existen", () => {
      const committedAt = new Date("2026-01-01T00:00:00.000Z");
      const reservation = buildAdminReservation({
        _id: objectId(),
        cartRef: "cart-1",
        lines: [{ variantId: objectId(), sku: "SKU-1", quantity: 1 }],
        status: ReservationStatus.COMMITTED,
        expiresAt: new Date(),
        committedAt,
      });

      expect(reservation.committedAt).toBe(committedAt.toISOString());
      expect(reservation.releasedAt).toBeUndefined();
    });
  });
});
