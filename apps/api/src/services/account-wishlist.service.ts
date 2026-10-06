import { Types } from "mongoose";
import { MAX_WISHLIST_ITEMS, ProductStatus, type WishlistItem } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";

/**
 * Guardados (máx. 50, sin duplicados). Se guarda solo la referencia
 * `(itemType, itemId)`; el contenido se hidrata contra el catálogo vivo en cada
 * lectura, así un cambio de precio o de stock se refleja siempre y un producto
 * archivado desaparece de la lista (y se poda de la libreta de paso).
 */

type WishlistItemType = "product";

interface StoredEntry {
  itemType: WishlistItemType;
  itemId: Types.ObjectId;
  addedAt: Date;
}

/** `true` si se agregó; `false` si ya estaba (guardar es idempotente). */
async function addWishlistItem(userId: string, itemType: WishlistItemType, itemId: string): Promise<boolean> {
  const exists = await Product.exists({ _id: itemId, status: ProductStatus.ACTIVE });
  if (!exists) throw new AppError("Producto no encontrado", 404);

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

async function listWishlist(userId: string): Promise<WishlistItem[]> {
  const user = await User.findById(userId).select("wishlist").lean<{ wishlist?: StoredEntry[] }>();
  const entries = user?.wishlist ?? [];
  if (entries.length === 0) return [];

  const products = await Product.find({ _id: { $in: entries.map((entry) => entry.itemId) }, status: ProductStatus.ACTIVE }).lean();
  const variantIds = products.flatMap((product) => product.variants.filter((variant) => variant.isActive).map((variant) => variant._id));
  const stock = await Inventory.find({ variantId: { $in: variantIds } }).select("variantId onHand reserved").lean();
  const sellable = new Set(stock.filter((row) => row.onHand - row.reserved > 0).map((row) => row.variantId.toString()));
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  const items: WishlistItem[] = [];
  const staleIds: Types.ObjectId[] = [];

  for (const entry of entries) {
    const product = byId.get(entry.itemId.toString());
    const active = product?.variants.filter((variant) => variant.isActive) ?? [];
    if (!product || active.length === 0) {
      staleIds.push(entry.itemId);
      continue;
    }
    const cheapest = active.reduce((best, variant) => (variant.price < best.price ? variant : best));
    const image = product.images[0];

    items.push({
      itemType: entry.itemType,
      itemId: product._id.toString(),
      slug: product.slug,
      name: product.name,
      ...(product.brand ? { brand: product.brand } : {}),
      ...(image ? { image: { url: image.url, ...(image.alt ? { alt: image.alt } : {}) } } : {}),
      priceCents: cheapest.price,
      ...(cheapest.listPrice != null && cheapest.listPrice > cheapest.price ? { listPriceCents: cheapest.listPrice } : {}),
      variantLabel: cheapest.name,
      available: active.some((variant) => sellable.has(variant._id.toString())),
      addedAt: entry.addedAt.toISOString(),
    });
  }

  // Poda de lo que ya no existe en el catálogo, para que el conteo converja
  // y los huecos no ocupen cupo. Mejor esfuerzo: nunca rompe la lectura.
  if (staleIds.length > 0) {
    void User.updateOne({ _id: userId }, { $pull: { wishlist: { itemId: { $in: staleIds } } } }).catch(() => undefined);
  }

  return items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export { addWishlistItem, removeWishlistItem, listWishlist };
export type { WishlistItemType };
