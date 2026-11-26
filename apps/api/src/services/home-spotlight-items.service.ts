import {
  BundleStatus,
  HomeSectionKey,
  type AdminHomeSpotlightItem,
  type HomeSpotlightKey,
  type ListQuery,
  type PublicBundle,
  type PublicProduct,
} from "@esencia-glow/shared";
import type { Types } from "mongoose";
import { Bundle } from "../models/bundle.model.js";
import { Product } from "../models/product.model.js";
import { buildPublicProductMatch } from "../utils/build-product-filter.js";
import { inSavedOrder } from "../utils/in-saved-order.js";
import { buildPublicBundles, listPublicBundles } from "./bundle-public.service.js";
import { buildImageDto, type LeanMediaImage, type LeanProduct } from "./catalog-dto.js";
import { buildPublicProductsWithRefs, listPublicProducts } from "./catalog-public.service.js";
import type { LeanBundle } from "./bundle-dto.js";
import { readHomeContent } from "./home-content-store.js";

/**
 * Tarjetas de Novedades y Kits del home (bloque 5). La sección guarda los ids
 * que eligió el panel, en orden; aquí se resuelven contra el catálogo.
 *
 * Sin selección (o si nada de lo elegido sigue publicado) el bloque cae al
 * modo automático —los cuatro más recientes— en vez de desaparecer: un
 * producto archivado no debe dejar un hueco en el home.
 */

const SPOTLIGHT_CARDS = 4;
const NEWEST: ListQuery = {
  page: 1,
  limit: SPOTLIGHT_CARDS,
  sort: { field: "createdAt", direction: "desc" },
  search: undefined,
};

async function resolvePublicNewArrivals(itemIds: Types.ObjectId[]): Promise<PublicProduct[]> {
  if (itemIds.length > 0) {
    const found = await Product.find(buildPublicProductMatch({ _id: { $in: itemIds } })).lean<LeanProduct[]>();
    const chosen = await buildPublicProductsWithRefs(inSavedOrder(itemIds, found));
    if (chosen.length > 0) return chosen;
  }
  return (await listPublicProducts({ ...NEWEST, newArrival: true })).products;
}

async function resolvePublicKits(itemIds: Types.ObjectId[]): Promise<PublicBundle[]> {
  if (itemIds.length > 0) {
    const found = await Bundle.find({ _id: { $in: itemIds }, status: BundleStatus.ACTIVE }).lean<LeanBundle[]>();
    const chosen = await buildPublicBundles(inSavedOrder(itemIds, found));
    if (chosen.length > 0) return chosen;
  }
  return (await listPublicBundles(NEWEST)).bundles;
}

interface NamedDoc {
  _id: Types.ObjectId;
  name: string;
  images?: LeanMediaImage[];
}

function toSummary(doc: NamedDoc, isPublished: boolean): AdminHomeSpotlightItem {
  const imageUrl = buildImageDto(doc.images?.[0])?.url;
  return { id: doc._id.toString(), name: doc.name, ...(imageUrl ? { imageUrl } : {}), isPublished };
}

/** Resumen de las tarjetas elegidas, en el orden guardado; los ids que ya no existen se descartan. */
async function listAdminSpotlightItems(key: HomeSpotlightKey): Promise<AdminHomeSpotlightItem[]> {
  const itemIds = (await readHomeContent())?.[key]?.itemIds ?? [];
  if (itemIds.length === 0) return [];

  if (key === HomeSectionKey.KITS) {
    const bundles = await Bundle.find({ _id: { $in: itemIds } }).select("name status images").lean<(NamedDoc & { status: string })[]>();
    return inSavedOrder(itemIds, bundles).map((bundle) => toSummary(bundle, bundle.status === BundleStatus.ACTIVE));
  }

  const [products, published] = await Promise.all([
    Product.find({ _id: { $in: itemIds } }).select("name images").lean<NamedDoc[]>(),
    Product.find(buildPublicProductMatch({ _id: { $in: itemIds } })).select("_id").lean<{ _id: Types.ObjectId }[]>(),
  ]);
  const publishedIds = new Set(published.map((product) => product._id.toString()));
  return inSavedOrder(itemIds, products).map((product) => toSummary(product, publishedIds.has(product._id.toString())));
}

export { resolvePublicNewArrivals, resolvePublicKits, listAdminSpotlightItems };
