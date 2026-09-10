import mongoose from "mongoose";
import { InventoryAction } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { recordAudit } from "../../src/services/audit.service.js";

describe("services/audit — acciones de inventario", () => {
  it("registra una InventoryAction igual que una AuthAction", async () => {
    const targetId = new mongoose.Types.ObjectId();

    await recordAudit({
      action: InventoryAction.STOCK_ADJUSTED,
      targetId,
      metadata: { delta: 5, reason: "reposición" },
    });

    const entry = await AuditLog.findOne({ targetId });
    expect(entry?.action).toBe(InventoryAction.STOCK_ADJUSTED);
    expect(entry?.metadata).toMatchObject({ delta: 5, reason: "reposición" });
  });
});
