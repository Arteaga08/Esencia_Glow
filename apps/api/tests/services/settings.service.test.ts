import mongoose from "mongoose";
import { DEFAULT_INVENTORY_SETTINGS } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Settings } from "../../src/models/settings.model.js";
import { getSettings, updateInventorySettings } from "../../src/services/settings.service.js";

describe("services/settings", () => {
  it("getSettings sin documento devuelve defaults y no crea el documento", async () => {
    const settings = await getSettings();

    expect(settings.inventory).toEqual(DEFAULT_INVENTORY_SETTINGS);
    expect(await Settings.countDocuments()).toBe(0);
  });

  it("updateInventorySettings parcial solo cambia lo enviado, el resto queda en su default", async () => {
    await updateInventorySettings({ lowStockThreshold: 10 });

    const settings = await getSettings();
    expect(settings.inventory.lowStockThreshold).toBe(10);
    expect(settings.inventory.reservationTtlMinutes).toBe(
      DEFAULT_INVENTORY_SETTINGS.reservationTtlMinutes,
    );
    expect(settings.inventory.sweepBatchSize).toBe(DEFAULT_INVENTORY_SETTINGS.sweepBatchSize);
  });

  it("no pisa otras secciones del singleton (prepara 1.8)", async () => {
    // Inserción cruda simulando una sección futura (home, de 1.8) ya presente
    // en el documento, para probar que actualizar inventory no la toca.
    await mongoose.connection
      .collection("settings")
      .insertOne({ _id: "global", home: { heroTitle: "Bienvenida" }, inventory: { lowStockThreshold: 3 } });

    await updateInventorySettings({ reservationTtlMinutes: 45 });

    const raw = await mongoose.connection.collection("settings").findOne({ _id: "global" });
    expect(raw?.home).toEqual({ heroTitle: "Bienvenida" });
    expect(raw?.inventory.lowStockThreshold).toBe(3);
    expect(raw?.inventory.reservationTtlMinutes).toBe(45);
  });

  it("rechaza un valor fuera de rango con 400", async () => {
    await expect(updateInventorySettings({ lowStockThreshold: -5 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
