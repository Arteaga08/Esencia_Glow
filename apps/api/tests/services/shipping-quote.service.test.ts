import mongoose from "mongoose";
import { ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { ShippingQuote } from "../../src/models/shipping-quote.model.js";
import { computeCartFingerprint } from "../../src/services/cart-fingerprint.js";
import { createShippingQuote, resolveUsableRate } from "../../src/services/shipping-quote.service.js";

let seedCounter = 0;

async function seedProduct() {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat Q${suffix}`, slug: `cat-q${suffix}` });
  const product = await Product.create({
    name: `Producto Q${suffix}`,
    slug: `producto-q${suffix}`,
    description: "d",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: `SKU-Q${suffix}`,
        name: "Variante",
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  return { variantId: product.variants[0]!._id };
}

const destination = {
  fullName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma",
  exteriorNumber: "100",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México" as const,
  postalCode: "06600",
};

describe("services/shipping-quote", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  it("crea una cotización con tarifas, monto más barato congelado y huella del carrito", async () => {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];

    const quote = await createShippingQuote({ userId, destination, lines });

    expect(quote.rates.length).toBeGreaterThan(0);
    expect(quote.cheapestAmountCents).toBe(Math.min(...quote.rates.map((r) => r.amountCents)));
    expect(quote.cartFingerprint).toBe(computeCartFingerprint(lines));
    expect(quote.provider).toBe("stub");
  });

  it("expiresAt respeta el TTL de commerce.shippingQuoteTtlMinutes y purgeAt = expiresAt + 24h", async () => {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];

    const before = Date.now();
    const quote = await createShippingQuote({ userId, destination, lines });

    const expectedExpiresAt = before + 60 * 60_000; // default de commerce.shippingQuoteTtlMinutes
    expect(quote.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiresAt - 2000);
    expect(quote.purgeAt.getTime()).toBe(quote.expiresAt.getTime() + 24 * 60 * 60_000);
  });

  it("resolveUsableRate devuelve la tarifa cuando todo coincide", async () => {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const quote = await createShippingQuote({ userId, destination, lines });
    const rateId = quote.rates[0]!.rateId;

    const { rate } = await resolveUsableRate({
      quoteId: quote._id.toString(),
      rateId,
      userId,
      cartFingerprint: computeCartFingerprint(lines),
    });

    expect(rate.rateId).toBe(rateId);
  });

  it("rechaza un rateId de una cotización de otro usuario", async () => {
    const { variantId } = await seedProduct();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const quote = await createShippingQuote({
      userId: new mongoose.Types.ObjectId().toString(),
      destination,
      lines,
    });

    await expect(
      resolveUsableRate({
        quoteId: quote._id.toString(),
        rateId: quote.rates[0]!.rateId,
        userId: new mongoose.Types.ObjectId().toString(),
        cartFingerprint: computeCartFingerprint(lines),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rechaza un rateId que no existe en la cotización", async () => {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const quote = await createShippingQuote({ userId, destination, lines });

    await expect(
      resolveUsableRate({
        quoteId: quote._id.toString(),
        rateId: "rate-inexistente",
        userId,
        cartFingerprint: computeCartFingerprint(lines),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rechaza una cotización vencida", async () => {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const quote = await createShippingQuote({ userId, destination, lines });
    await ShippingQuote.updateOne({ _id: quote._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(
      resolveUsableRate({
        quoteId: quote._id.toString(),
        rateId: quote.rates[0]!.rateId,
        userId,
        cartFingerprint: computeCartFingerprint(lines),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rechaza cuando el carrito cambió desde que se cotizó (fingerprint distinto)", async () => {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const quote = await createShippingQuote({ userId, destination, lines });

    await expect(
      resolveUsableRate({
        quoteId: quote._id.toString(),
        rateId: quote.rates[0]!.rateId,
        userId,
        cartFingerprint: computeCartFingerprint([{ itemType: "product", itemId: variantId.toString(), quantity: 5 }]),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("no es de un solo uso: un replay de idempotencia puede volver a leer la misma tarifa", async () => {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    const quote = await createShippingQuote({ userId, destination, lines });
    const rateId = quote.rates[0]!.rateId;
    const fingerprint = computeCartFingerprint(lines);

    await resolveUsableRate({ quoteId: quote._id.toString(), rateId, userId, cartFingerprint: fingerprint });
    await expect(
      resolveUsableRate({ quoteId: quote._id.toString(), rateId, userId, cartFingerprint: fingerprint }),
    ).resolves.toBeDefined();
  });
});
