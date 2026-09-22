import mongoose from "mongoose";
import { ProductStatus } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { ShippingQuote } from "../../src/models/shipping-quote.model.js";
import { computeCartFingerprint } from "../../src/services/cart-fingerprint.js";
import { ShippingProviderError, __setShippingProviderForTests } from "../../src/services/shipping-provider.js";
import { createShippingQuote, resolveUsableRate } from "../../src/services/shipping-quote.service.js";
import { AppError } from "../../src/utils/app-error.js";
import { buildFakeShippingProvider } from "../helpers/fake-shipping-provider.js";

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

describe("services/shipping-quote — proveedor, deadline y errores explícitos", () => {
  beforeEach(() => {
    seedCounter = 0;
  });

  async function quoteInput() {
    const { variantId } = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    return { userId, destination, lines };
  }

  it("persiste el nombre del proveedor y su providerQuoteId en la cotización", async () => {
    __setShippingProviderForTests(buildFakeShippingProvider({ name: "skydropx" }));
    const quote = await createShippingQuote(await quoteInput());
    expect(quote.provider).toBe("skydropx");
    expect(quote.providerQuoteId).toBe("stub-quote");
  });

  it("le pasa al proveedor una señal de deadline (AbortSignal) en cada cotización", async () => {
    const fake = buildFakeShippingProvider();
    __setShippingProviderForTests(fake);
    await createShippingQuote(await quoteInput());
    const options = vi.mocked(fake.getRates).mock.calls[0]![2];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal!.aborted).toBe(false);
  });

  it("un proveedor que NUNCA responde (ignora la señal) se corta con 504 al vencer el deadline y no persiste nada", async () => {
    __setShippingProviderForTests(buildFakeShippingProvider({ getRates: () => new Promise(() => {}) }));
    const error = await createShippingQuote(await quoteInput(), { timeoutMs: 30 }).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(504);
    expect(error.message).toBe("La cotización de envío tardó demasiado, intenta de nuevo.");
    expect(await ShippingQuote.countDocuments()).toBe(0);
  });

  it("un proveedor que respeta la señal y rechaza al abortar también termina en 504 (no en 502)", async () => {
    __setShippingProviderForTests(
      buildFakeShippingProvider({
        getRates: (_d, _p, { signal }) =>
          new Promise((_resolve, reject) => {
            signal!.addEventListener("abort", () => reject(new ShippingProviderError("unavailable", "abortado")));
          }),
      }),
    );
    const error = await createShippingQuote(await quoteInput(), { timeoutMs: 30 }).catch((e) => e);
    expect(error.statusCode).toBe(504);
  });

  it.each(["rejected", "unavailable", "unknown_outcome"] as const)(
    "un ShippingProviderError '%s' se degrada a 502 explícito y no persiste nada",
    async (kind) => {
      __setShippingProviderForTests(
        buildFakeShippingProvider({ getRates: () => Promise.reject(new ShippingProviderError(kind, "detalle interno")) }),
      );
      const error = await createShippingQuote(await quoteInput()).catch((e) => e);
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(502);
      expect(error.message).toBe("No pudimos cotizar el envío en este momento.");
      expect(error.message).not.toContain("detalle interno");
      expect(await ShippingQuote.countDocuments()).toBe(0);
    },
  );

  it("una excepción inesperada del adapter (bug, no ShippingProviderError) también es 502, nunca 500", async () => {
    __setShippingProviderForTests(buildFakeShippingProvider({ getRates: () => Promise.reject(new TypeError("boom")) }));
    const error = await createShippingQuote(await quoteInput()).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
  });

  it("una lista de tarifas vacía es 422 y no persiste una cotización sin opciones", async () => {
    __setShippingProviderForTests(buildFakeShippingProvider({ getRates: async () => ({ rates: [] }) }));
    const error = await createShippingQuote(await quoteInput()).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe("No hay opciones de envío para esta dirección.");
    expect(await ShippingQuote.countDocuments()).toBe(0);
  });

  it("sin proveedor configurado lanza 503", async () => {
    __setShippingProviderForTests(undefined);
    const error = await createShippingQuote(await quoteInput()).catch((e) => e);
    expect(error.statusCode).toBe(503);
  });
});
