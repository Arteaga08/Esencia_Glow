import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { BundleStatus, ProductStatus, type CartLineInput } from "@esencia-glow/shared";
import { Bundle } from "../../src/models/bundle.model.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { createShippingQuote } from "../../src/services/shipping-quote.service.js";
import type { CreateOrderInput } from "../../src/services/order.service.js";

/**
 * Setup compartido del carril crítico de checkout: categoría -> producto ->
 * variantes -> inventario -> bundle -> cotización de envío. Cada suite de
 * `order.service`, idempotencia/concurrencia y las rutas de orden reusan
 * esto en vez de reinventar el `seedVariant` local que cada suite de 1.4
 * traía por su cuenta — el setup aquí es demasiado pesado para justificar
 * la duplicación.
 */

let seedCounter = 0;

function resetCheckoutFixtureCounter(): void {
  seedCounter = 0;
}

const CHECKOUT_DESTINATION = {
  fullName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma",
  exteriorNumber: "100",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México" as const,
  postalCode: "06600",
};

interface SeedVariantOpts {
  price?: number;
  onHand?: number;
  weightGrams?: number;
}

async function seedVariantWithStock(opts: SeedVariantOpts = {}) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat CO${suffix}`, slug: `cat-co${suffix}` });
  const product = await Product.create({
    name: `Producto CO${suffix}`,
    slug: `producto-co${suffix}`,
    description: "Descripción de prueba",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    variants: [
      {
        sku: `SKU-CO${suffix}`,
        name: "Variante",
        price: opts.price ?? 50000,
        weightGrams: opts.weightGrams ?? 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({
    productId: product._id,
    variantId: variant._id,
    sku: variant.sku,
    onHand: opts.onHand ?? 10,
    reserved: 0,
  });
  return { product, variantId: variant._id, sku: variant.sku, price: variant.price };
}

async function seedBundleWithStock(componentPrice = 50000, bundlePrice = 89900) {
  const { product, variantId } = await seedVariantWithStock({ price: componentPrice });
  seedCounter += 1;
  const bundle = await Bundle.create({
    name: "Kit Glow",
    slug: `kit-glow-${seedCounter}`,
    description: "Kit de prueba",
    price: bundlePrice,
    items: [{ productId: product._id, variantId, quantity: 2 }],
    status: BundleStatus.ACTIVE,
  });
  return { bundle, product, variantId };
}

/** Cotiza envío para las líneas dadas y devuelve `{quoteId, rateId}` listo
 * para pasarle a `createOrder`. */
async function quoteCheckout(userId: string, lines: CartLineInput[]) {
  const quote = await createShippingQuote({ userId, destination: CHECKOUT_DESTINATION, lines });
  return { quoteId: quote._id.toString(), rateId: quote.rates[0]!.rateId };
}

/** Arma un `CreateOrderInput` completo: cotiza envío y sella una
 * `idempotencyKey` aleatoria salvo que el caller quiera fijarla (para
 * probar replay/concurrencia). */
async function buildCreateOrderInput(
  userId: string,
  lines: CartLineInput[],
  overrides: Partial<CreateOrderInput> = {},
): Promise<CreateOrderInput> {
  const { quoteId, rateId } = await quoteCheckout(userId, lines);
  return {
    userId,
    lines,
    quoteId,
    rateId,
    termsAccepted: true,
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

function randomUserId(): string {
  return new mongoose.Types.ObjectId().toString();
}

export {
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
  seedBundleWithStock,
  quoteCheckout,
  buildCreateOrderInput,
  randomUserId,
  CHECKOUT_DESTINATION,
};
