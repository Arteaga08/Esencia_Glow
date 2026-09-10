import type { Types } from "mongoose";
import {
  CATALOG_CURRENCY,
  type BundleStatus,
  type PublicBundle,
  type PublicBundleItem,
  type PublicProductImage,
} from "@esencia-glow/shared";
import type { LeanMediaImage, LeanProduct } from "./catalog-dto.js";
import { buildImageDto, buildAttributesDto } from "./catalog-dto.js";

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
  items: LeanBundleItem[];
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
  items: AdminBundleItem[];
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
  return {
    id: bundle._id.toString(),
    name: bundle.name,
    slug: bundle.slug,
    description: bundle.description,
    images: bundle.images.map((image) => buildImageDto(image)!),
    price: bundle.price,
    items: bundle.items.map(buildAdminBundleItem),
    status: bundle.status,
    stockCache: bundle.stockCache,
  };
}

/** No hay stock en el DTO público — igual que `PublicProduct`: la
 * disponibilidad se decide al reservar, no se anuncia de antemano. */
function buildPublicBundle(
  bundle: LeanBundle,
  productById: Map<string, LeanProduct>,
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

  return {
    id: bundle._id.toString(),
    name: bundle.name,
    slug: bundle.slug,
    description: bundle.description,
    images: bundle.images.map((image) => buildImageDto(image)!),
    price: bundle.price,
    currency: CATALOG_CURRENCY,
    items,
  };
}

export { buildAdminBundle, buildPublicBundle };
export type { LeanBundle, LeanBundleItem, AdminBundle, AdminBundleItem };
