import { BundleStatus, type ListQuery, type PaginationMeta, type PublicBundle } from "@esencia-glow/shared";
import { Bundle } from "../models/bundle.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildPublicBundle, type LeanBundle } from "./bundle-dto.js";
import type { LeanProduct } from "./catalog-dto.js";

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
    .select("name images variants")
    .lean<LeanProduct[]>();
  return new Map(products.map((product) => [product._id.toString(), product]));
}

async function listPublicBundles(
  input: ListQuery,
): Promise<{ bundles: PublicBundle[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = { status: BundleStatus.ACTIVE };
  if (input.search) filter.name = new RegExp(escapeRegex(input.search), "i");

  const sort = resolveSort(input.sort, PUBLIC_BUNDLE_SORT_FIELDS, "createdAt");

  const [documents, total] = await Promise.all([
    Bundle.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanBundle[]>(),
    Bundle.countDocuments(filter),
  ]);

  const productById = await fetchProductsByIds(
    documents.flatMap((bundle) => bundle.items.map((item) => item.productId.toString())),
  );

  return {
    bundles: documents.map((bundle) => buildPublicBundle(bundle, productById)),
    meta: buildMeta(total, input),
  };
}

async function getPublicBundleBySlug(slug: string): Promise<PublicBundle> {
  const bundle = await Bundle.findOne({ slug, status: BundleStatus.ACTIVE }).lean<LeanBundle>();
  if (!bundle) throw new AppError("Paquete no encontrado", 404);

  const productById = await fetchProductsByIds(bundle.items.map((item) => item.productId.toString()));
  return buildPublicBundle(bundle, productById);
}

export { listPublicBundles, getPublicBundleBySlug };
