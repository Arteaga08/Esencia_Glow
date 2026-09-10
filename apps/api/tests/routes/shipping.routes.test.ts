import { ProductStatus } from "@esencia-glow/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

async function seedProduct() {
  const category = await Category.create({ name: "Cat Ship", slug: "cat-ship" });
  const product = await Product.create({
    name: "Producto Ship",
    slug: "producto-ship",
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: "SKU-SHIP",
        name: "Variante",
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  return { variantId: product.variants[0]!._id.toString() };
}

const destination = {
  fullName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma",
  exteriorNumber: "100",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
};

describe("routes/shipping — cotización", () => {
  it("401 sin sesión", async () => {
    const res = await request(app).post("/api/v1/shipping/quotes").send({ destination, lines: [] });
    expect(res.status).toBe(401);
  });

  it("cotiza y devuelve tarifas sin exponer providerRateId", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);

    const res = await agent.post("/api/v1/shipping/quotes").send({
      destination,
      lines: [{ itemType: "product", itemId: variantId, quantity: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.rates.length).toBeGreaterThan(0);
    for (const rate of res.body.data.rates) {
      expect(rate.providerRateId).toBeUndefined();
      expect(typeof rate.rateId).toBe("string");
    }
  });

  it("un código postal inválido responde 400", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);

    const res = await agent.post("/api/v1/shipping/quotes").send({
      destination: { ...destination, postalCode: "ABC" },
      lines: [{ itemType: "product", itemId: variantId, quantity: 1 }],
    });

    expect(res.status).toBe(400);
  });

  it("un estado fuera de la lista cerrada responde 400", async () => {
    const { variantId } = await seedProduct();
    const { agent } = await createCustomerSession(app);

    const res = await agent.post("/api/v1/shipping/quotes").send({
      destination: { ...destination, state: "Nueva York" },
      lines: [{ itemType: "product", itemId: variantId, quantity: 1 }],
    });

    expect(res.status).toBe(400);
  });
});
