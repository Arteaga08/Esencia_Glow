import mongoose from "mongoose";
import { MAX_ORDER_LINES } from "@esencia-glow/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { resetCheckoutFixtureCounter, seedBundleWithStock, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

const app = buildApp();
const objectId = () => new mongoose.Types.ObjectId().toString();

describe("POST /api/v1/cart/resolve", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  it("responde 200 sin sesión con el precio y la disponibilidad vivos", async () => {
    const { variantId, price } = await seedVariantWithStock({ price: 34900 });
    const res = await request(app)
      .post("/api/v1/cart/resolve")
      .send({ lines: [{ itemType: "product", itemId: variantId.toString() }] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ itemId: variantId.toString(), available: true, priceCents: price });
  });

  it("resuelve un lote mixto con un kit y una línea inexistente sin tumbar el lote", async () => {
    const kit = await seedBundleWithStock();
    const ghost = objectId();
    const res = await request(app)
      .post("/api/v1/cart/resolve")
      .send({
        lines: [
          { itemType: "bundle", itemId: kit.bundle._id.toString() },
          { itemType: "product", itemId: ghost },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ itemType: "bundle", available: true });
    expect(res.body.data[1]).toEqual({ itemType: "product", itemId: ghost, available: false });
  });

  it("descarta cantidades y montos del body (stripUnknown)", async () => {
    const { variantId, price } = await seedVariantWithStock({ price: 50000 });
    const res = await request(app)
      .post("/api/v1/cart/resolve")
      .send({ lines: [{ itemType: "product", itemId: variantId.toString(), quantity: 99, priceCents: 1 }], total: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data[0].priceCents).toBe(price);
  });

  it("rechaza un lote vacío con 400", async () => {
    const res = await request(app).post("/api/v1/cart/resolve").send({ lines: [] });
    expect(res.status).toBe(400);
  });

  it("rechaza un body sin lines con 400", async () => {
    const res = await request(app).post("/api/v1/cart/resolve").send({});
    expect(res.status).toBe(400);
  });

  it(`rechaza más de ${MAX_ORDER_LINES} líneas con 400`, async () => {
    const lines = Array.from({ length: MAX_ORDER_LINES + 1 }, () => ({ itemType: "product", itemId: objectId() }));
    const res = await request(app).post("/api/v1/cart/resolve").send({ lines });
    expect(res.status).toBe(400);
  });

  it("rechaza un id mal formado con 400", async () => {
    const res = await request(app)
      .post("/api/v1/cart/resolve")
      .send({ lines: [{ itemType: "product", itemId: "no-es-un-id" }] });
    expect(res.status).toBe(400);
  });

  it("rechaza un itemType desconocido con 400", async () => {
    const res = await request(app)
      .post("/api/v1/cart/resolve")
      .send({ lines: [{ itemType: "subscription", itemId: objectId() }] });
    expect(res.status).toBe(400);
  });
});
