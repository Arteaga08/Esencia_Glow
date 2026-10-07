import {
  BundleStatus,
  type ListQuery,
  type PaginationMeta,
  type PublicBundle,
  type PublicBundleAvailability,
  type PublicBundleFacets,
} from "@esencia-glow/shared";
import { Bundle } from "../models/bundle.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { computeBundleAvailability } from "./bundle-availability.service.js";
import { buildPublicBundle, type LeanBundle } from "./bundle-dto.js";
import type { LeanProduct } from "./catalog-dto.js";
import { resolveBadgeRefs } from "./catalog-public.service.js";

const PUBLIC_BUNDLE_SORT_FIELDS = ["createdAt", "name", "price"] as const;

/**
 * Resuelve, en una sola query batch, los productos dueños de los items de una
 * página de bundles — mismo precedente que `resolveCategoryRef` en
 * catalog-public.service.ts, pero para varios documentos a la vez en vez de
 * uno solo (evita N+1 al listar).
 */
async function fetchProductsByIds(productIds: string[]): Promise<Map<string, LeanProduct>> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return new Map();

  const products = await Product.find({ _id: { $in: uniqueIds } })
    .select("name slug status images variants")
    .lean<LeanProduct[]>();
  return new Map(products.map((product) => [product._id.toString(), product]));
}

interface ListPublicBundlesInput extends ListQuery {
  minPrice?: number;
  maxPrice?: number;
}

async function listPublicBundles(
  input: ListPublicBundlesInput,
): Promise<{ bundles: PublicBundle[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = { status: BundleStatus.ACTIVE };
  if (input.search) filter.name = new RegExp(escapeRegex(input.search), "i");
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    filter.price = {
      ...(input.minPrice !== undefined ? { $gte: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { $lte: input.maxPrice } : {}),
    };
  }

  const sort = resolveSort(input.sort, PUBLIC_BUNDLE_SORT_FIELDS, "createdAt");

  const [documents, total] = await Promise.all([
    Bundle.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanBundle[]>(),
    Bundle.countDocuments(filter),
  ]);

  const [productById, badgeById] = await Promise.all([
    fetchProductsByIds(documents.flatMap((bundle) => bundle.items.map((item) => item.productId.toString()))),
    resolveBadgeRefs(documents.map((bundle) => bundle.badgeId)),
  ]);

  return {
    bundles: documents.map((bundle) =>
      buildPublicBundle(bundle, productById, bundle.badgeId ? badgeById.get(bundle.badgeId.toString()) : undefined),
    ),
    meta: buildMeta(total, input),
  };
}

async function getPublicBundleBySlug(slug: string): Promise<PublicBundle> {
  const bundle = await Bundle.findOne({ slug, status: BundleStatus.ACTIVE }).lean<LeanBundle>();
  if (!bundle) throw new AppError("Paquete no encontrado", 404);

  const [productById, badgeById] = await Promise.all([
    fetchProductsByIds(bundle.items.map((item) => item.productId.toString())),
    resolveBadgeRefs([bundle.badgeId]),
  ]);
  return buildPublicBundle(bundle, productById, bundle.badgeId ? badgeById.get(bundle.badgeId.toString()) : undefined);
}

/** Rango de precio de los paquetes publicados; sin ninguno, ambos `null`. */
async function getPublicBundleFacets(): Promise<PublicBundleFacets> {
  const [summary] = await Bundle.aggregate<{ minPrice: number; maxPrice: number }>([
    { $match: { status: BundleStatus.ACTIVE } },
    { $group: { _id: null, minPrice: { $min: "$price" }, maxPrice: { $max: "$price" } } },
  ]);
  return { minPrice: summary?.minPrice ?? null, maxPrice: summary?.maxPrice ?? null };
}

/**
 * Señal booleana, nunca el conteo — mismo criterio que
 * `getPublicVariantAvailability` (catalog-public.service.ts), extendido a
 * paquetes: la PDP de un bundle necesita la misma señal que la de un
 * producto. Se calcula EN VIVO con `computeBundleAvailability` (nunca desde
 * `Bundle.stockCache`, que es solo una caché de display para el dashboard).
 */
async function getPublicBundleAvailability(slug: string): Promise<PublicBundleAvailability> {
  const bundle = await Bundle.findOne({ slug, status: BundleStatus.ACTIVE }).lean<LeanBundle>();
  if (!bundle) throw new AppError("Paquete no encontrado", 404);

  const possible = await computeBundleAvailability(bundle.items);
  return { isAvailable: possible > 0 };
}

export { listPublicBundles, getPublicBundleBySlug, getPublicBundleAvailability, getPublicBundleFacets };
export type { ListPublicBundlesInput };
