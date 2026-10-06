import { BundleStatus, ProductChannel, ProductStatus, type PublicCartLine, type ResolveCartLineInput } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { computeBundleAvailability } from "./bundle-availability.service.js";
import {
  findVariant,
  loadCartCatalog,
  type LeanBundleForCart,
  type LeanProductForCart,
} from "./cart-resolution.service.js";

/**
 * Lectura pública del carrito (Milestone 3.4a): el carrito vive en el navegador
 * y esto le devuelve el precio y la disponibilidad VIVOS de cada línea. Es de
 * solo lectura y nunca lanza por una línea: lo que no se puede vender vuelve
 * como `{ itemType, itemId, available: false }` SIN datos (un borrador o un
 * producto de suscripción no se filtran), y lo que se vende pero está agotado
 * vuelve completo con `available: false` para que la tienda lo muestre tachado.
 *
 * Reusa `loadCartCatalog` del resolvedor de la orden: ambos deciden sobre los
 * mismos datos. La disponibilidad es informativa; la reserva real decide al pagar.
 */

function unavailable(line: ResolveCartLineInput): PublicCartLine {
  return { itemType: line.itemType, itemId: line.itemId, available: false };
}

/** "A la venta" para el carrito: activo, no exclusivo de suscripción. */
function isProductSellable(product: LeanProductForCart): boolean {
  return product.status === ProductStatus.ACTIVE && product.channel !== ProductChannel.SUBSCRIPTION;
}

function toImage(image: { url: string; alt?: string } | undefined): PublicCartLine["image"] {
  return image ? { url: image.url, ...(image.alt ? { alt: image.alt } : {}) } : undefined;
}

function listPriceFields(price: number, listPrice: number | null | undefined) {
  return listPrice != null && listPrice > price ? { listPriceCents: listPrice } : {};
}

/** Quita duplicados conservando el orden en que llegaron. */
function dedupeLines(lines: readonly ResolveCartLineInput[]): ResolveCartLineInput[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = `${line.itemType}:${line.itemId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveProductLine(
  line: ResolveCartLineInput,
  product: LeanProductForCart | undefined,
  stock: Map<string, number>,
): PublicCartLine {
  const variant = product && findVariant(product, line.itemId);
  if (!product || !variant || !variant.isActive || !isProductSellable(product)) return unavailable(line);

  const image = toImage(product.images[0]);
  return {
    itemType: "product",
    itemId: line.itemId,
    available: (stock.get(line.itemId) ?? 0) > 0,
    slug: product.slug,
    name: product.name,
    ...(product.brand ? { brand: product.brand } : {}),
    variantLabel: variant.name,
    priceCents: variant.price,
    ...listPriceFields(variant.price, variant.listPrice),
    ...(image ? { image } : {}),
  };
}

async function resolveBundleLine(
  line: ResolveCartLineInput,
  bundle: LeanBundleForCart | undefined,
  productsById: Map<string, LeanProductForCart>,
): Promise<PublicCartLine> {
  if (!bundle || bundle.status !== BundleStatus.ACTIVE) return unavailable(line);

  const components = bundle.items.map((item) => {
    const product = productsById.get(item.productId.toString());
    const variant = product && findVariant(product, item.variantId.toString());
    return { product, variant };
  });
  const sellable = components.every(
    ({ product, variant }) => product && variant?.isActive && isProductSellable(product),
  );
  if (!sellable) return unavailable(line);

  // Foto propia del kit; si no tiene, la del primer componente que la tenga.
  const image = toImage(bundle.images[0] ?? components.find(({ product }) => product?.images[0])?.product?.images[0]);
  const units = bundle.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    itemType: "bundle",
    itemId: line.itemId,
    available: (await computeBundleAvailability(bundle.items)) > 0,
    slug: bundle.slug,
    name: bundle.name,
    variantLabel: `${units} ${units === 1 ? "producto" : "productos"}`,
    priceCents: bundle.price,
    ...listPriceFields(bundle.price, bundle.listPrice),
    ...(image ? { image } : {}),
  };
}

async function resolvePublicCart(lines: readonly ResolveCartLineInput[]): Promise<PublicCartLine[]> {
  const unique = dedupeLines(lines);
  const { productsByVariantId, bundlesById, productsById } = await loadCartCatalog(unique);

  // Una sola consulta de stock para todas las variantes sueltas del lote.
  const variantIds = unique.filter((line) => line.itemType === "product").map((line) => line.itemId);
  const rows = await Inventory.find({ variantId: { $in: variantIds } })
    .select("variantId onHand reserved")
    .lean();
  const stock = new Map(rows.map((row) => [row.variantId.toString(), Math.max(0, row.onHand - row.reserved)]));

  return Promise.all(
    unique.map((line) =>
      line.itemType === "product"
        ? resolveProductLine(line, productsByVariantId.get(line.itemId), stock)
        : resolveBundleLine(line, bundlesById.get(line.itemId), productsById),
    ),
  );
}

export { resolvePublicCart };
