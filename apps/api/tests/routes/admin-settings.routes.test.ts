import request from "supertest";
import { DEFAULT_INVENTORY_SETTINGS, InventoryAction } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

describe("routes/admin-settings", () => {
  it("sin cookie responde 401", async () => {
    const response = await request(app).get("/api/v1/admin/settings");
    expect(response.status).toBe(401);
  });

  it("una cookie de customer responde 403", async () => {
    const { agent } = await createCustomerSession(app);
    const response = await agent.get("/api/v1/admin/settings");
    expect(response.status).toBe(403);
  });

  it("GET sin documento devuelve los defaults", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent.get("/api/v1/admin/settings");

    expect(response.status).toBe(200);
    expect(response.body.data.inventory).toEqual(DEFAULT_INVENTORY_SETTINGS);
  });

  it("PATCH persiste y el GET siguiente lo refleja", async () => {
    const { agent } = await createAdminSession(app);

    const patch = await agent.patch("/api/v1/admin/settings/inventory").send({ lowStockThreshold: 20 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.lowStockThreshold).toBe(20);

    const get = await agent.get("/api/v1/admin/settings");
    expect(get.body.data.inventory.lowStockThreshold).toBe(20);

    const entry = await AuditLog.findOne({ action: InventoryAction.SETTINGS_UPDATED });
    expect(entry).not.toBeNull();
    expect(entry?.metadata).toMatchObject({ lowStockThreshold: 20 });
  });

  it("una clave desconocida responde 400", async () => {
    const { agent } = await createAdminSession(app);
    const response = await agent
      .patch("/api/v1/admin/settings/inventory")
      .send({ unknownField: 1 });
    expect(response.status).toBe(400);
  });
});
