import mongoose from "mongoose";
import { DEFAULT_COMMERCE_SETTINGS, DEFAULT_INVENTORY_SETTINGS } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Settings } from "../../src/models/settings.model.js";
import {
  getSettings,
  updateCommerceSettings,
  updateInventorySettings,
} from "../../src/services/settings.service.js";

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

  it("getSettings sin documento devuelve defaults de commerce también", async () => {
    const settings = await getSettings();
    expect(settings.commerce).toEqual(DEFAULT_COMMERCE_SETTINGS);
  });

  it("updateCommerceSettings parcial solo cambia lo enviado", async () => {
    await updateCommerceSettings({ taxRateBps: 1000 });

    const settings = await getSettings();
    expect(settings.commerce.taxRateBps).toBe(1000);
    expect(settings.commerce.freeShippingThresholdCents).toBe(
      DEFAULT_COMMERCE_SETTINGS.freeShippingThresholdCents,
    );
    expect(settings.commerce.shippingQuoteTtlMinutes).toBe(
      DEFAULT_COMMERCE_SETTINGS.shippingQuoteTtlMinutes,
    );
  });

  it("actualizar commerce no pisa inventory, ni viceversa", async () => {
    await updateInventorySettings({ lowStockThreshold: 7 });
    await updateCommerceSettings({ taxRateBps: 800 });

    const settings = await getSettings();
    expect(settings.inventory.lowStockThreshold).toBe(7);
    expect(settings.commerce.taxRateBps).toBe(800);
  });

  it("rechaza taxRateBps fuera de rango con 400", async () => {
    await expect(updateCommerceSettings({ taxRateBps: 20000 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rechaza freeShippingThresholdCents negativo con 400", async () => {
    await expect(updateCommerceSettings({ freeShippingThresholdCents: -1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("la cotización de envío debe superar el TTL de reserva: rechaza shippingQuoteTtlMinutes <= reservationTtlMinutes", async () => {
    await updateInventorySettings({ reservationTtlMinutes: 30 });

    await expect(updateCommerceSettings({ shippingQuoteTtlMinutes: 30 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(updateCommerceSettings({ shippingQuoteTtlMinutes: 20 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(updateCommerceSettings({ shippingQuoteTtlMinutes: 45 })).resolves.toMatchObject({
      shippingQuoteTtlMinutes: 45,
    });
  });

  it("subir el TTL de reserva por encima del de la cotización de envío también se rechaza", async () => {
    await updateCommerceSettings({ shippingQuoteTtlMinutes: 60 });

    await expect(updateInventorySettings({ reservationTtlMinutes: 60 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(updateInventorySettings({ reservationTtlMinutes: 90 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(updateInventorySettings({ reservationTtlMinutes: 45 })).resolves.toMatchObject({
      reservationTtlMinutes: 45,
    });
  });
});
