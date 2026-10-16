import { createHash, createHmac } from "node:crypto";
import mongoose from "mongoose";
import { InventoryAction } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
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

describe("services/audit — ipHash", () => {
  it("guarda la IP como HMAC con la clave de auditoría, no como SHA-256 sin clave", async () => {
    const targetId = new mongoose.Types.ObjectId();
    const ip = "189.203.10.4";

    await recordAudit({ action: InventoryAction.STOCK_ADJUSTED, targetId, ip });

    const entry = await AuditLog.findOne({ targetId });
    expect(entry?.ipHash).toBe(createHmac("sha256", env.auditIpHmacKey).update(ip).digest("hex"));
    expect(entry?.ipHash).not.toBe(createHash("sha256").update(ip).digest("hex"));
  });
});
