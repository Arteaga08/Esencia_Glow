import { Types } from "mongoose";
import { BundleStatus, MAX_WISHLIST_ITEMS, ProductStatus, type WishlistItem, type WishlistItemType } from "@esencia-glow/shared";
import { Bundle } from "../models/bundle.model.js";
import { Inventory } from "../models/inventory.model.js";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { computeBundleAvailability } from "./bundle-availability.service.js";
import type { LeanBundle } from "./bundle-dto.js";

/**
 * Guardados (máx. 50, sin duplicados): productos y kits. Se guarda solo la
 * referencia `(itemType, itemId)`; el contenido se hidrata contra el catálogo
 * vivo en cada lectura, así un cambio de precio o de stock se refleja siempre.
 *
 * Lo que no está a la venta (producto en borrador, archivado o sin variantes
 * activas; kit no publicado) se OCULTA pero el guardado se conserva: reaparece
 * si se reactiva. Solo se poda el guardado cuyo producto o kit ya no existe en
 * su colección. Los ocultos siguen ocupando cupo del tope.
 */

interface StoredEntry {
  itemType: WishlistItemType;
  itemId: Types.ObjectId;
  addedAt: Date;
}

/** "A la venta": activo y con al menos una variante activa. Un solo criterio para guardar, listar y contar. */
const VISIBLE_PRODUCT_FILTER = { status: ProductStatus.ACTIVE, variants: { $elemMatch: { isActive: true } } };
/** Un kit está a la venta si está publicado; si hoy se puede armar lo dice `available`. */
const VISIBLE_BUNDLE_FILTER = { status: BundleStatus.ACTIVE };

function idsOfType(entries: Array<{ itemType: WishlistItemType; itemId: Types.ObjectId }>, itemType: WishlistItemType): Types.ObjectId[] {
  return entries.filter((entry) => entry.itemType === itemType).map((entry) => entry.itemId);
}

/** Cuántos guardados son visibles hoy (lo que lista `/mi-cuenta/guardados`). */
async function countVisibleWishlist(entries: Array<{ itemType: WishlistItemType; itemId: Types.ObjectId }> | undefined): Promise<number> {
  if (!entries || entries.length === 0) return 0;
  const productIds = idsOfType(entries, "product");
  const bundleIds = idsOfType(entries, "bundle");
  const [products, bundles] = await Promise.all([
    productIds.length > 0 ? Product.countDocuments({ _id: { $in: productIds }, ...VISIBLE_PRODUCT_FILTER }) : 0,
    bundleIds.length > 0 ? Bundle.countDocuments({ _id: { $in: bundleIds }, ...VISIBLE_BUNDLE_FILTER }) : 0,
  ]);
  return products + bundles;
}

/** ¿Está guardado? Consulta solo la libreta de la clienta: no toca el catálogo. */
async function isWishlisted(userId: string, itemType: WishlistItemType, itemId: string): Promise<{ saved: boolean }> {
  const found = await User.exists({ _id: userId, wishlist: { $elemMatch: { itemType, itemId: new Types.ObjectId(itemId) } } });
  return { saved: found !== null };
}

async function assertSellable(itemType: WishlistItemType, itemId: string): Promise<void> {
  if (itemType === "bundle") {
    if (!(await Bundle.exists({ _id: itemId, ...VISIBLE_BUNDLE_FILTER }))) throw new AppError("Kit no encontrado", 404);
    return;
  }
  if (!(await Product.exists({ _id: itemId, ...VISIBLE_PRODUCT_FILTER }))) throw new AppError("Producto no encontrado", 404);
}

/** `true` si se agregó; `false` si ya estaba (guardar es idempotente). */
async function addWishlistItem(userId: string, itemType: WishlistItemType, itemId: string): Promise<boolean> {
  await assertSellable(itemType, itemId);

  const id = new Types.ObjectId(itemId);
  // Tope y no-duplicado dentro de la propia escritura: sin carrera posible.
  const result = await User.updateOne(
    { _id: userId, [`wishlist.${MAX_WISHLIST_ITEMS - 1}`]: { $exists: false }, "wishlist.itemId": { $ne: id } },
    { $push: { wishlist: { itemType, itemId: id, addedAt: new Date() } } },
  );
  if (result.modifiedCount === 1) return true;

  if (await User.exists({ _id: userId, "wishlist.itemId": id })) return false;
  throw new AppError(`Puedes guardar hasta ${MAX_WISHLIST_ITEMS} productos. Quita alguno para guardar otro.`, 409);
}

async function removeWishlistItem(userId: string, itemType: WishlistItemType, itemId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { wishlist: { itemType, itemId: new Types.ObjectId(itemId) } } });
}

type Hydrated = Omit<WishlistItem, "addedAt">;
/** `null` = existe pero está oculto; ausente del mapa = ya no existe (se poda). */
type HydratedById = Map<string, Hydrated | null>;

async function hydrateProducts(ids: Types.ObjectId[]): Promise<HydratedById> {
  const byId: HydratedById = new Map();
  if (ids.length === 0) return byId;

  const products = await Product.find({ _id: { $in: ids } }).lean();
  const variantIds = products.flatMap((product) =>
    product.status === ProductStatus.ACTIVE ? product.variants.filter((variant) => variant.isActive).map((variant) => variant._id) : [],
  );
  const stock = await Inventory.find({ variantId: { $in: variantIds } }).select("variantId onHand reserved").lean();
  const sellable = new Set(stock.filter((row) => row.onHand - row.reserved > 0).map((row) => row.variantId.toString()));

  for (const product of products) {
    const active = product.variants.filter((variant) => variant.isActive);
    if (product.status !== ProductStatus.ACTIVE || active.length === 0) {
      byId.set(product._id.toString(), null);
      continue;
    }
    const cheapest = active.reduce((best, variant) => (variant.price < best.price ? variant : best));
    const image = product.images[0];

    byId.set(product._id.toString(), {
      itemType: "product",
      itemId: product._id.toString(),
      slug: product.slug,
      name: product.name,
      ...(product.brand ? { brand: product.brand } : {}),
      ...(image ? { image: { url: image.url, ...(image.alt ? { alt: image.alt } : {}) } } : {}),
      priceCents: cheapest.price,
      ...(cheapest.listPrice != null && cheapest.listPrice > cheapest.price ? { listPriceCents: cheapest.listPrice } : {}),
      variantLabel: cheapest.name,
      available: active.some((variant) => sellable.has(variant._id.toString())),
    });
  }
  return byId;
}

/**
 * Kits: precio propio, "N productos" como etiqueta y disponibilidad EN VIVO
 * (`computeBundleAvailability`, como la ficha del kit; nunca `stockCache`).
 * Sin foto propia usa la del primer componente que tenga, igual que la tienda.
 */
async function hydrateBundles(ids: Types.ObjectId[]): Promise<HydratedById> {
  const byId: HydratedById = new Map();
  if (ids.length === 0) return byId;

  const bundles = await Bundle.find({ _id: { $in: ids } }).lean<LeanBundle[]>();
  const visible = bundles.filter((bundle) => bundle.status === BundleStatus.ACTIVE);
  for (const bundle of bundles) if (bundle.status !== BundleStatus.ACTIVE) byId.set(bundle._id.toString(), null);

  const componentIds = visible.filter((bundle) => bundle.images.length === 0).flatMap((bundle) => bundle.items.map((item) => item.productId));
  const [components, possible] = await Promise.all([
    componentIds.length > 0 ? Product.find({ _id: { $in: componentIds } }).select("images").lean() : [],
    Promise.all(visible.map((bundle) => computeBundleAvailability(bundle.items))),
  ]);
  const imageByProduct = new Map(components.flatMap((product) => (product.images[0] ? [[product._id.toString(), product.images[0]] as const] : [])));

  visible.forEach((bundle, index) => {
    const image = bundle.images[0] ?? bundle.items.map((item) => imageByProduct.get(item.productId.toString())).find(Boolean);
    const units = bundle.items.reduce((sum, item) => sum + item.quantity, 0);

    byId.set(bundle._id.toString(), {
      itemType: "bundle",
      itemId: bundle._id.toString(),
      slug: bundle.slug,
      name: bundle.name,
      ...(image ? { image: { url: image.url, ...(image.alt ? { alt: image.alt } : {}) } } : {}),
      priceCents: bundle.price,
      ...(bundle.listPrice != null && bundle.listPrice > bundle.price ? { listPriceCents: bundle.listPrice } : {}),
      variantLabel: `${units} ${units === 1 ? "producto" : "productos"}`,
      available: (possible[index] ?? 0) > 0,
    });
  });
  return byId;
}

async function listWishlist(userId: string): Promise<WishlistItem[]> {
  const user = await User.findById(userId).select("wishlist").lean<{ wishlist?: StoredEntry[] }>();
  const entries = user?.wishlist ?? [];
  if (entries.length === 0) return [];

  const [products, bundles] = await Promise.all([hydrateProducts(idsOfType(entries, "product")), hydrateBundles(idsOfType(entries, "bundle"))]);

  const items: WishlistItem[] = [];
  const staleIds: Types.ObjectId[] = [];

  for (const entry of entries) {
    const byId = entry.itemType === "bundle" ? bundles : products;
    const key = entry.itemId.toString();
    // Inexistente → se poda; existe pero fuera de venta → se oculta y se conserva.
    if (!byId.has(key)) {
      staleIds.push(entry.itemId);
      continue;
    }
    const hydrated = byId.get(key);
    if (hydrated) items.push({ ...hydrated, addedAt: entry.addedAt.toISOString() });
  }

  // Poda de lo que ya no existe en la colección, para que los huecos no
  // ocupen cupo. Mejor esfuerzo: nunca rompe la lectura.
  if (staleIds.length > 0) {
    void User.updateOne({ _id: userId }, { $pull: { wishlist: { itemId: { $in: staleIds } } } }).catch(() => undefined);
  }

  return items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export { addWishlistItem, removeWishlistItem, listWishlist, isWishlisted, countVisibleWishlist };
