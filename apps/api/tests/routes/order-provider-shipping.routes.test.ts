import { randomUUID } from "node:crypto";
import { ProductStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Product } from "../../src/models/product.model.js";
import { __setShippingProviderForTests } from "../../src/services/shipping-provider.js";
import { createCustomerSession } from "../helpers/admin-session.js";
import { CHECKOUT_DESTINATION } from "../helpers/checkout-fixtures.js";
import { buildFakeShippingProvider } from "../helpers/fake-shipping-provider.js";

const app = buildApp();

async function seedVariant() {
  const category = await Category.create({ name: "Cat Snap", slug: "cat-snap" });
  const product = await Product.create({
    name: "Producto Snap",
    slug: "producto-snap",
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: "SKU-SNAP",
        name: "Variante",
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand: 10, reserved: 0 });
  return variant._id.toString();
}

/** Checkout completo eligiendo la SEGUNDA tarifa cotizada. */
async function checkoutChoosingSecondRate() {
  __setShippingProviderForTests(buildFakeShippingProvider({ name: "skydropx" }));
  const variantId = await seedVariant();
  const { agent } = await createCustomerSession(app);
  const lines = [{ itemType: "product", itemId: variantId, quantity: 1 }];

  const quoteRes = await agent.post("/api/v1/shipping/quotes").send({ destination: CHECKOUT_DESTINATION, lines });
  expect(quoteRes.status).toBe(201);
  const { id: quoteId, rates } = quoteRes.body.data;

  const orderRes = await agent
    .post("/api/v1/orders")
    .set("Idempotency-Key", randomUUID())
    .send({ lines, quoteId, rateId: rates[1].rateId, paymentMethod: "card", termsAccepted: true });
  expect(orderRes.status).toBe(201);
  return { agent, orderRes, orderId: orderRes.body.data.order.id as string };
}

describe("checkout — snapshot del proveedor de envíos en la orden", () => {
  it("guarda proveedor, cotización y tarifa DEL PROVEEDOR de la opción elegida (no de otra)", async () => {
    const { orderId } = await checkoutChoosingSecondRate();
    const order = await Order.findById(orderId).lean();
    expect(order!.providerShipping).toEqual({
      provider: "skydropx",
      providerQuoteId: "stub-quote",
      providerRateId: "stub-1",
    });
  });

  it("la respuesta de crear la orden NO expone ningún id del proveedor", async () => {
    const { orderRes } = await checkoutChoosingSecondRate();
    const body = JSON.stringify(orderRes.body);
    expect(body).not.toContain("providerRateId");
    expect(body).not.toContain("providerQuoteId");
    expect(body).not.toContain("providerShipping");
    expect(body).not.toContain("stub-1");
    expect(body).not.toContain("stub-quote");
  });

  it("el detalle de la orden para la clienta tampoco lo expone", async () => {
    const { agent, orderId } = await checkoutChoosingSecondRate();
    const res = await agent.get(`/api/v1/orders/${orderId}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("providerRateId");
    expect(body).not.toContain("providerQuoteId");
    expect(body).not.toContain("providerShipping");
  });
});
