import mongoose from "mongoose";
import { InventoryAction } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";

describe("models/AuditLog — acepta acciones de inventario", () => {
  it("crea un registro con una InventoryAction sin fallar la validación del enum", async () => {
    const doc = await AuditLog.create({
      action: InventoryAction.STOCK_ADJUSTED,
      targetId: new mongoose.Types.ObjectId(),
      metadata: { delta: -3, reason: "conteo físico" },
    });

    expect(doc.action).toBe(InventoryAction.STOCK_ADJUSTED);
  });
});
