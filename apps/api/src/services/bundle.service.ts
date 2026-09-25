import { Types, type FilterQuery } from "mongoose";
import { BundleStatus, ProductChannel, type ListQuery, type PaginationMeta } from "@esencia-glow/shared";
import { Bundle, type BundleAttrs, type BundleDocument } from "../models/bundle.model.js";
import { Product } from "../models/product.model.js";
import { Badge } from "../models/badge.model.js";
import type { ProductContentAttrs, ProductContentItemAttrs } from "../models/product-content.schema.js";
import { AppError } from "../utils/app-error.js";
import { slugify } from "../utils/slugify.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { computeBundleAvailability } from "./bundle-availability.service.js";
import { buildAdminBundle, type AdminBundle, type LeanBundle } from "./bundle-dto.js";

/** Contenido editorial parcial: cada bloque se reemplaza completo cuando
 * llega, igual que `Bundle.items` — no hay sub-CRUD por línea. Mismo criterio
 * que `ProductContentInput` en product.service.ts. */
interface BundleContentInput {
  ingredients?: ProductContentItemAttrs[];
  routineSteps?: ProductContentItemAttrs[];
  usage?: ProductContentItemAttrs[];
  benefits?: ProductContentItemAttrs[];
}

const BUNDLE_SORT_FIELDS = ["createdAt", "updatedAt", "name", "price", "status"] as const;

interface BundleItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

interface CreateBundleInput {
  name: string;
  description: string;
  price: number;
  listPrice?: number | null;
  badgeId?: string | null;
  content?: BundleContentInput;
  items: BundleItemInput[];
}

interface UpdateBundleInput {
  name?: string;
  description?: string;
  price?: number;
  listPrice?: number | null;
  badgeId?: string | null;
  content?: BundleContentInput;
  items?: BundleItemInput[];
  status?: BundleStatus;
}

interface ListBundlesInput extends ListQuery {
  status?: BundleStatus;
}

/**
 * Valida que cada línea apunte a un producto y una variante que de verdad
 * existen y que la variante de verdad pertenezca a ese producto — sin esto,
 * un bundle podría "armarse" con un `variantId` de otro producto por error de
 * captura, y solo se descubriría al intentar venderlo.
 *
 * También rechaza componentes de canal `SUBSCRIPTION` (Milestone 1.7.1): el
 * admin se entera al curar el bundle, no la clienta al pagar (el bloqueo
 * real, para cualquier bundle ya existente, vive en
 * cart-resolution.service.ts).
 */
async function assertItemsValid(items: BundleItemInput[]): Promise<void> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds } }).select("variants channel").lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new AppError(`El producto ${item.productId} no existe`, 400);

    const belongsToProduct = product.variants.some((variant) => variant._id.toString() === item.variantId);
    if (!belongsToProduct) {
      throw new AppError(`La variante ${item.variantId} no pertenece al producto ${item.productId}`, 400);
    }

    if (product.channel === ProductChannel.SUBSCRIPTION) {
      throw new AppError(
        `El producto ${item.productId} es exclusivo de la caja de suscripción y no puede usarse en un paquete`,
        400,
      );
    }
  }
}

async function assertBadgeExists(badgeId: string): Promise<void> {
  const exists = await Badge.exists({ _id: badgeId });
  if (!exists) throw new AppError("La badge no existe", 400);
}

/**
 * Mismo rol que `assertListPriceAboveSalePrice` en product-variant.service.ts:
 * el `.custom()` de bundle.validator.ts solo cruza `price`/`listPrice` cuando
 * AMBOS llegan en el mismo payload — un `PATCH` que cambia solo `listPrice`
 * necesita compararlo contra el `price` YA GUARDADO, que Joi no conoce.
 */
function assertListPriceAboveSalePrice(bundle: { price: number; listPrice: number | null }): void {
  if (bundle.listPrice != null && bundle.listPrice <= bundle.price) {
    throw new AppError("El precio anterior debe ser mayor al precio actual", 400, {
      listPrice: "El precio anterior debe ser mayor al precio actual",
    });
  }
}

async function createBundle(input: CreateBundleInput): Promise<BundleDocument> {
  await assertItemsValid(input.items);
  if (input.badgeId) await assertBadgeExists(input.badgeId);
  const stockCache = await computeBundleAvailability(input.items);

  const bundle = new Bundle({
    name: input.name,
    slug: slugify(input.name),
    description: input.description,
    price: input.price,
    listPrice: input.listPrice ?? null,
    badgeId: input.badgeId ?? null,
    content: input.content,
    items: input.items,
    stockCache,
  });
  assertListPriceAboveSalePrice(bundle);
  await bundle.save();
  return bundle;
}

async function getBundleDocument(id: string): Promise<BundleDocument> {
  const bundle = await Bundle.findById(id);
  if (!bundle) throw new AppError("Paquete no encontrado", 404);
  return bundle;
}

async function updateBundle(id: string, input: UpdateBundleInput): Promise<BundleDocument> {
  const bundle = await getBundleDocument(id);

  if (input.items !== undefined) {
    await assertItemsValid(input.items);
    bundle.items = input.items.map((item) => ({
      productId: new Types.ObjectId(item.productId),
      variantId: new Types.ObjectId(item.variantId),
      quantity: item.quantity,
    }));
    bundle.stockCache = await computeBundleAvailability(input.items);
  }
  if (input.name !== undefined) {
    bundle.name = input.name;
    bundle.slug = slugify(input.name);
  }
  if (input.description !== undefined) bundle.description = input.description;
  if (input.price !== undefined) bundle.price = input.price;
  if (input.listPrice !== undefined) bundle.listPrice = input.listPrice;
  if (input.badgeId !== undefined) {
    if (input.badgeId) await assertBadgeExists(input.badgeId);
    bundle.badgeId = input.badgeId as unknown as BundleDocument["badgeId"];
  }
  if (input.content !== undefined) {
    bundle.content = { ...bundle.content, ...input.content } as ProductContentAttrs;
  }
  if (input.status !== undefined) bundle.status = input.status;

  assertListPriceAboveSalePrice({ price: bundle.price, listPrice: bundle.listPrice });
  await bundle.save();
  return bundle;
}

/** "Eliminar" un bundle archiva, nunca borra: las órdenes (1.5) lo referenciarán. */
async function archiveBundle(id: string): Promise<void> {
  const bundle = await getBundleDocument(id);
  bundle.status = BundleStatus.ARCHIVED;
  await bundle.save();
}

async function listBundles(
  input: ListBundlesInput,
): Promise<{ bundles: AdminBundle[]; meta: PaginationMeta }> {
  const filter: FilterQuery<BundleAttrs> = {};
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = new RegExp(escapeRegex(input.search), "i");

  const sort = resolveSort(input.sort, BUNDLE_SORT_FIELDS, "createdAt");

  const [documents, total] = await Promise.all([
    Bundle.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanBundle[]>(),
    Bundle.countDocuments(filter),
  ]);

  return { bundles: documents.map(buildAdminBundle), meta: buildMeta(total, input) };
}

async function getBundleById(id: string): Promise<AdminBundle> {
  const bundle = await Bundle.findById(id).lean<LeanBundle>();
  if (!bundle) throw new AppError("Paquete no encontrado", 404);
  return buildAdminBundle(bundle);
}

export {
  createBundle,
  updateBundle,
  archiveBundle,
  listBundles,
  getBundleById,
  getBundleDocument,
  assertItemsValid,
};
export type { CreateBundleInput, UpdateBundleInput, ListBundlesInput, BundleItemInput };
