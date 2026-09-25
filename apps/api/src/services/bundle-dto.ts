import type { Types } from "mongoose";
import {
  CATALOG_CURRENCY,
  type BundleStatus,
  type ProductContent,
  type PublicBundle,
  type PublicBundleItem,
  type PublicProductImage,
} from "@esencia-glow/shared";
import type { ProductContentAttrs } from "../models/product-content.schema.js";
import type { LeanBadge, LeanMediaImage, LeanProduct } from "./catalog-dto.js";
import { buildAttributesDto, buildContentDto, buildImageDto, buildPublicBadge } from "./catalog-dto.js";

/**
 * DTOs de `Bundle`, mismo precedente que catalog-dto.ts: reciben formas
 * estructurales (lean), nunca deciden negocio. La única particularidad frente
 * a Product/Category es que el DTO público de item necesita el `Product`
 * dueño ya resuelto (`productById`) — el bundle solo guarda `productId`/
 * `variantId`, no un snapshot del nombre — así que quien arma el DTO
 * (bundle-public.service.ts) debe resolverlo antes, con una sola query batch.
 */

interface LeanBundleItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
}

interface LeanBundle {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  images: LeanMediaImage[];
  price: number;
  listPrice: number | null;
  badgeId: Types.ObjectId | null;
  items: LeanBundleItem[];
  content?: ProductContentAttrs;
  status: BundleStatus;
  stockCache: number;
}

interface AdminBundleItem {
  productId: string;
  variantId: string;
  quantity: number;
}

interface AdminBundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: PublicProductImage[];
  price: number;
  listPrice: number | null;
  badgeId: string | null;
  items: AdminBundleItem[];
  content?: ProductContent;
  status: BundleStatus;
  /** Caché de display, no fuente de verdad — ver bundle-availability.service.ts. */
  stockCache: number;
}

function buildAdminBundleItem(item: LeanBundleItem): AdminBundleItem {
  return {
    productId: item.productId.toString(),
    variantId: item.variantId.toString(),
    quantity: item.quantity,
  };
}

function buildAdminBundle(bundle: LeanBundle): AdminBundle {
  const content = buildContentDto(bundle.content);
  return {
    id: bundle._id.toString(),
    name: bundle.name,
    slug: bundle.slug,
    description: bundle.description,
    images: bundle.images.map((image) => buildImageDto(image)!),
    price: bundle.price,
    listPrice: bundle.listPrice ?? null,
    badgeId: bundle.badgeId ? bundle.badgeId.toString() : null,
    items: bundle.items.map(buildAdminBundleItem),
    ...(content ? { content } : {}),
    status: bundle.status,
    stockCache: bundle.stockCache,
  };
}

/** No hay stock en el DTO público — igual que `PublicProduct`: la
 * disponibilidad se decide al reservar, no se anuncia de antemano. */
function buildPublicBundle(
  bundle: LeanBundle,
  productById: Map<string, LeanProduct>,
  badge?: LeanBadge,
): PublicBundle {
  const items: PublicBundleItem[] = bundle.items.map((item) => {
    const product = productById.get(item.productId.toString());
    const variant = product?.variants.find((v) => v._id.toString() === item.variantId.toString());
    return {
      productId: item.productId.toString(),
      variantId: item.variantId.toString(),
      name: variant ? `${product!.name} — ${variant.name}` : "Producto no disponible",
      attributes: buildAttributesDto(variant?.attributes),
      image: product?.images[0] ? buildImageDto(product.images[0]) : undefined,
      quantity: item.quantity,
    };
  });

  const content = buildContentDto(bundle.content);

  return {
    id: bundle._id.toString(),
    name: bundle.name,
    slug: bundle.slug,
    description: bundle.description,
    images: bundle.images.map((image) => buildImageDto(image)!),
    price: bundle.price,
    ...(bundle.listPrice != null ? { listPrice: bundle.listPrice } : {}),
    currency: CATALOG_CURRENCY,
    items,
    ...(badge ? { badge: buildPublicBadge(badge) } : {}),
    ...(content ? { content } : {}),
  };
}

export { buildAdminBundle, buildPublicBundle };
export type { LeanBundle, LeanBundleItem, AdminBundle, AdminBundleItem };
