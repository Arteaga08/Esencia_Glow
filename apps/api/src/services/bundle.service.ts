import { Types, type FilterQuery } from "mongoose";
import { BundleStatus, type ListQuery, type PaginationMeta } from "@esencia-glow/shared";
import { Bundle, type BundleAttrs, type BundleDocument } from "../models/bundle.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { slugify } from "../utils/slugify.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { computeBundleAvailability } from "./bundle-availability.service.js";
import { buildAdminBundle, type AdminBundle, type LeanBundle } from "./bundle-dto.js";

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
  items: BundleItemInput[];
}

interface UpdateBundleInput {
  name?: string;
  description?: string;
  price?: number;
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
 */
async function assertItemsValid(items: BundleItemInput[]): Promise<void> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds } }).select("variants").lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new AppError(`El producto ${item.productId} no existe`, 400);

    const belongsToProduct = product.variants.some((variant) => variant._id.toString() === item.variantId);
    if (!belongsToProduct) {
      throw new AppError(`La variante ${item.variantId} no pertenece al producto ${item.productId}`, 400);
    }
  }
}

async function createBundle(input: CreateBundleInput): Promise<BundleDocument> {
  await assertItemsValid(input.items);
  const stockCache = await computeBundleAvailability(input.items);

  const bundle = new Bundle({
    name: input.name,
    slug: slugify(input.name),
    description: input.description,
    price: input.price,
    items: input.items,
    stockCache,
  });
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
  if (input.status !== undefined) bundle.status = input.status;

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
