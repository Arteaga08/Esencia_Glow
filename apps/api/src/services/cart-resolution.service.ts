import { Types, type ClientSession } from "mongoose";
import { BundleStatus, MAX_BUNDLE_QUANTITY, MAX_ORDER_LINES, ProductStatus } from "@esencia-glow/shared";
import { Bundle, type BundleAttrs } from "../models/bundle.model.js";
import { Product, type ProductAttrs } from "../models/product.model.js";

/** Formas lean explícitas: `Attrs` no declara `_id` (convención del
 * repo), pero un `.lean()` real siempre lo trae. */
type LeanProductForCart = ProductAttrs & { _id: Types.ObjectId };
type LeanBundleForCart = BundleAttrs & { _id: Types.ObjectId };
import { AppError } from "../utils/app-error.js";
import { normalizeCartLines, type CartLineForFingerprint } from "./cart-fingerprint.js";

/**
 * Resuelve las líneas crudas del carrito (`{itemType, itemId, quantity}`)
 * contra el catálogo real — es el único lugar que precia, arma el snapshot
 * y expande bundles a componentes. Lo usan tanto la cotización de envío
 * (solo necesita `parcelItems`) como la creación de la orden (necesita todo
 * el snapshot, corriendo DENTRO de su transacción vía `session`).
 *
 * `itemId` es el `variantId` para una línea `product` y el `bundleId` para
 * una línea `bundle` — nunca un `productId` suelto, porque el precio/peso
 * vive en la variante, no en el producto.
 */

interface CartLineInput {
  itemType: "product" | "bundle";
  itemId: string;
  quantity: number;
}

interface ResolvedComponent {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  name: string;
  variantName: string;
  quantity: number;
  catalogUnitPriceCents: number;
}

interface ResolvedParcelItem {
  weightGrams: number;
  dimensionsCm: { length: number; width: number; height: number };
  quantity: number;
}

interface ResolvedLine {
  itemType: "product" | "bundle";
  itemId: string;
  quantity: number;
  sku: string;
  name: string;
  variantName?: string;
  attributes?: { size?: string; shade?: string; volume?: string };
  unitPriceCents: number;
  lineTotalCents: number;
  components?: ResolvedComponent[];
  reservationLines: { variantId: string; quantity: number }[];
  sourceBundle?: { bundleId: string; quantity: number };
  parcelItems: ResolvedParcelItem[];
}

function assertLinesWithinLimits(inputs: readonly CartLineInput[]): void {
  if (inputs.length === 0) {
    throw new AppError("Tu carrito está vacío.", 400);
  }
  if (inputs.length > MAX_ORDER_LINES) {
    throw new AppError(`Tu carrito no puede tener más de ${MAX_ORDER_LINES} líneas.`, 400);
  }
  for (const input of inputs) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new AppError("La cantidad de cada línea debe ser un entero mayor a 0.", 400);
    }
    if (input.itemType === "bundle" && input.quantity > MAX_BUNDLE_QUANTITY) {
      throw new AppError(`No puedes comprar más de ${MAX_BUNDLE_QUANTITY} unidades del mismo paquete.`, 400);
    }
  }
}

function findVariant(product: LeanProductForCart, variantId: string) {
  return product.variants.find((v) => v._id?.toString() === variantId);
}

async function resolveProductLine(
  line: CartLineInput,
  productsByVariantId: Map<string, LeanProductForCart>,
): Promise<ResolvedLine> {
  const product = productsByVariantId.get(line.itemId);
  const variant = product && findVariant(product, line.itemId);
  if (!product || !variant || product.status !== ProductStatus.ACTIVE || !variant.isActive) {
    throw new AppError("Una o más variantes ya no están disponibles para la venta.", 409);
  }

  return {
    itemType: "product",
    itemId: line.itemId,
    quantity: line.quantity,
    sku: variant.sku,
    name: product.name,
    variantName: variant.name,
    attributes: variant.attributes,
    unitPriceCents: variant.price,
    lineTotalCents: variant.price * line.quantity,
    reservationLines: [{ variantId: line.itemId, quantity: line.quantity }],
    parcelItems: [{ weightGrams: variant.weightGrams, dimensionsCm: variant.dimensionsCm, quantity: line.quantity }],
  };
}

async function resolveBundleLine(
  line: CartLineInput,
  bundlesById: Map<string, LeanBundleForCart>,
  productsById: Map<string, LeanProductForCart>,
): Promise<ResolvedLine> {
  const bundle = bundlesById.get(line.itemId);
  if (!bundle || bundle.status !== BundleStatus.ACTIVE) {
    throw new AppError("Paquete no disponible.", 404);
  }

  const components: ResolvedComponent[] = [];
  const reservationLines: { variantId: string; quantity: number }[] = [];
  const parcelItems: ResolvedParcelItem[] = [];

  for (const item of bundle.items) {
    const product = productsById.get(item.productId.toString());
    const variant = product && findVariant(product, item.variantId.toString());
    if (!product || !variant || product.status !== ProductStatus.ACTIVE || !variant.isActive) {
      throw new AppError("El paquete no está disponible: uno de sus componentes ya no se vende.", 409);
    }

    const quantity = item.quantity * line.quantity;
    components.push({
      productId: item.productId,
      variantId: item.variantId,
      sku: variant.sku,
      name: product.name,
      variantName: variant.name,
      quantity,
      catalogUnitPriceCents: variant.price,
    });
    reservationLines.push({ variantId: item.variantId.toString(), quantity });
    parcelItems.push({ weightGrams: variant.weightGrams, dimensionsCm: variant.dimensionsCm, quantity });
  }

  return {
    itemType: "bundle",
    itemId: line.itemId,
    quantity: line.quantity,
    sku: `BUNDLE-${bundle._id?.toString().slice(-8).toUpperCase()}`,
    name: bundle.name,
    unitPriceCents: bundle.price,
    lineTotalCents: bundle.price * line.quantity,
    components,
    reservationLines,
    sourceBundle: { bundleId: line.itemId, quantity: line.quantity },
    parcelItems,
  };
}

async function resolveCartLines(
  inputs: readonly CartLineInput[],
  session?: ClientSession,
): Promise<ResolvedLine[]> {
  assertLinesWithinLimits(inputs);

  // Dedupe/fusiona por (itemType, itemId) ANTES de resolver, con el mismo
  // criterio que `cart-fingerprint.ts` — dos líneas para el mismo producto
  // en el payload no deben leerse ni facturarse dos veces por separado.
  const normalized: CartLineForFingerprint[] = normalizeCartLines(inputs);

  const productVariantIds = normalized.filter((l) => l.itemType === "product").map((l) => l.itemId);
  const bundleIds = normalized.filter((l) => l.itemType === "bundle").map((l) => l.itemId);

  const productsQuery = Product.find({
    "variants._id": { $in: productVariantIds.map((id) => new Types.ObjectId(id)) },
  }).lean<LeanProductForCart[]>();
  if (session) productsQuery.session(session);

  const bundlesQuery = Bundle.find({
    _id: { $in: bundleIds.map((id) => new Types.ObjectId(id)) },
  }).lean<LeanBundleForCart[]>();
  if (session) bundlesQuery.session(session);

  const [directProducts, bundles] = await Promise.all([productsQuery, bundlesQuery]);

  const productsByVariantId = new Map<string, LeanProductForCart>();
  for (const product of directProducts) {
    for (const variant of product.variants) {
      productsByVariantId.set(variant._id.toString(), product);
    }
  }
  const bundlesById = new Map(bundles.map((b) => [b._id.toString(), b]));

  // Los productos componentes de un bundle pueden NO estar en
  // `directProducts` (el cliente no los pidió sueltos) — se resuelven en un
  // segundo batch a partir de los `productId` de cada bundle.
  const componentProductIds = new Set<string>();
  for (const bundle of bundles) {
    for (const item of bundle.items) componentProductIds.add(item.productId.toString());
  }
  const componentProductsQuery = Product.find({
    _id: { $in: [...componentProductIds].map((id) => new Types.ObjectId(id)) },
  }).lean<LeanProductForCart[]>();
  if (session) componentProductsQuery.session(session);
  const componentProducts = componentProductIds.size > 0 ? await componentProductsQuery : [];

  const productsById = new Map(componentProducts.map((p) => [p._id.toString(), p]));
  for (const product of directProducts) productsById.set(product._id.toString(), product);

  const resolved: ResolvedLine[] = [];
  for (const line of normalized) {
    resolved.push(
      line.itemType === "product"
        ? await resolveProductLine(line, productsByVariantId)
        : await resolveBundleLine(line, bundlesById, productsById),
    );
  }

  return resolved;
}

export { resolveCartLines };
export type { CartLineInput, ResolvedLine, ResolvedComponent, ResolvedParcelItem };
