import { Types } from "mongoose";
import { MAX_WISHLIST_ITEMS, ProductStatus, type WishlistItem } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";

/**
 * Guardados (máx. 50, sin duplicados). Se guarda solo la referencia
 * `(itemType, itemId)`; el contenido se hidrata contra el catálogo vivo en cada
 * lectura, así un cambio de precio o de stock se refleja siempre.
 *
 * Un producto que no está a la venta (borrador, archivado o sin variantes
 * activas) se OCULTA pero el guardado se conserva: reaparece si se reactiva. Solo
 * se poda el guardado cuyo producto ya no existe en la colección. Los ocultos
 * siguen ocupando cupo del tope.
 */

type WishlistItemType = "product";

interface StoredEntry {
  itemType: WishlistItemType;
  itemId: Types.ObjectId;
  addedAt: Date;
}

/** "A la venta": activo y con al menos una variante activa. Un solo criterio para guardar, listar y contar. */
const VISIBLE_PRODUCT_FILTER = { status: ProductStatus.ACTIVE, variants: { $elemMatch: { isActive: true } } };

/** Cuántos guardados son visibles hoy (lo que lista `/mi-cuenta/guardados`). */
async function countVisibleWishlist(entries: Array<{ itemId: Types.ObjectId }> | undefined): Promise<number> {
  if (!entries || entries.length === 0) return 0;
  return Product.countDocuments({ _id: { $in: entries.map((entry) => entry.itemId) }, ...VISIBLE_PRODUCT_FILTER });
}

/** ¿Está guardado? Consulta solo la libreta de la clienta: no toca el catálogo. */
async function isWishlisted(userId: string, itemType: WishlistItemType, itemId: string): Promise<{ saved: boolean }> {
  const found = await User.exists({ _id: userId, wishlist: { $elemMatch: { itemType, itemId: new Types.ObjectId(itemId) } } });
  return { saved: found !== null };
}

/** `true` si se agregó; `false` si ya estaba (guardar es idempotente). */
async function addWishlistItem(userId: string, itemType: WishlistItemType, itemId: string): Promise<boolean> {
  const exists = await Product.exists({ _id: itemId, ...VISIBLE_PRODUCT_FILTER });
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

  const products = await Product.find({ _id: { $in: entries.map((entry) => entry.itemId) } }).lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));
  const variantIds = products.flatMap((product) =>
    product.status === ProductStatus.ACTIVE ? product.variants.filter((variant) => variant.isActive).map((variant) => variant._id) : [],
  );
  const stock = await Inventory.find({ variantId: { $in: variantIds } }).select("variantId onHand reserved").lean();
  const sellable = new Set(stock.filter((row) => row.onHand - row.reserved > 0).map((row) => row.variantId.toString()));

  const items: WishlistItem[] = [];
  const staleIds: Types.ObjectId[] = [];

  for (const entry of entries) {
    const product = byId.get(entry.itemId.toString());
    // Inexistente → se poda; existe pero fuera de venta → se oculta y se conserva.
    if (!product) {
      staleIds.push(entry.itemId);
      continue;
    }
    const active = product.variants.filter((variant) => variant.isActive);
    if (product.status !== ProductStatus.ACTIVE || active.length === 0) continue;
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

  // Poda de lo que ya no existe en la colección, para que los huecos no
  // ocupen cupo. Mejor esfuerzo: nunca rompe la lectura.
  if (staleIds.length > 0) {
    void User.updateOne({ _id: userId }, { $pull: { wishlist: { itemId: { $in: staleIds } } } }).catch(() => undefined);
  }

  return items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export { addWishlistItem, removeWishlistItem, listWishlist, isWishlisted, countVisibleWishlist };
export type { WishlistItemType };
