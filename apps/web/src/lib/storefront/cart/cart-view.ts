import { DEFAULT_COMMERCE_SETTINGS, type PublicCartLine } from "@esencia-glow/shared";
import { lineKey, type Cart, type CartItemType } from "./cart-store";

/**
 * Lo que pinta el panel y la página del carrito: lo guardado en el navegador
 * (cantidad + snapshot) fundido con la respuesta viva de `/cart/resolve`
 * (precio, nombre, foto y disponibilidad al día).
 */
interface CartLineView {
  key: string;
  itemType: CartItemType;
  itemId: string;
  kind: "product" | "kit";
  brand?: string;
  name: string;
  /** Presentación elegida ("30 ml") o "N productos" en un kit. */
  variantLabel: string;
  priceCents: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  quantity: number;
  image?: { url: string; alt: string };
  slug?: string;
  available: boolean;
}

interface CartTotals {
  itemCount: number;
  subtotalCents: number;
  /** `null` mientras la clienta no ha elegido una tarifa de envío. */
  shippingCents: number | null;
  /** Desglose del IVA ya incluido en el total, nunca un cargo extra. */
  taxCents: number;
  totalCents: number;
}

/**
 * Sin respuesta viva (cargando o con error) se pinta el snapshot y se asume
 * disponible: la reserva real decide al pagar. Una línea que la API marca como
 * no disponible sin datos (ya no se vende) conserva el snapshot para que la
 * clienta vea qué era y pueda quitarla.
 */
function buildCartView(cart: Cart, live: readonly PublicCartLine[] | null): CartLineView[] {
  const liveByKey = new Map((live ?? []).map((line) => [lineKey(line.itemType, line.itemId), line]));

  return cart.map((line) => {
    const key = lineKey(line.itemType, line.itemId);
    const fresh = liveByKey.get(key);
    const hasData = fresh?.name !== undefined && fresh.priceCents !== undefined;

    const name = hasData ? fresh.name! : line.snapshot.name;
    const image = hasData ? (fresh.image ?? line.snapshot.image) : line.snapshot.image;
    const listPriceCents = hasData ? fresh.listPriceCents : line.snapshot.listPriceCents;
    const brand = hasData ? fresh.brand : line.snapshot.brand;
    const slug = (hasData ? fresh.slug : undefined) ?? line.snapshot.slug;

    return {
      key,
      itemType: line.itemType,
      itemId: line.itemId,
      kind: line.itemType === "bundle" ? "kit" : "product",
      ...(brand ? { brand } : {}),
      name,
      variantLabel: hasData ? (fresh.variantLabel ?? line.snapshot.variantLabel) : line.snapshot.variantLabel,
      priceCents: hasData ? fresh.priceCents! : line.snapshot.priceCents,
      ...(listPriceCents ? { listPriceCents } : {}),
      quantity: line.quantity,
      ...(image ? { image: { url: image.url, alt: image.alt ?? name } } : {}),
      ...(slug ? { slug } : {}),
      available: fresh ? fresh.available : true,
    };
  });
}

/**
 * Misma aritmética que `order-totals.ts` del API: los precios ya traen el IVA,
 * así que se desglosa del total (neto redondeado, impuesto por resta). Las
 * líneas agotadas no suman: no se pueden comprar. El IVA sale de los defaults
 * compartidos; no hay lectura pública de Ajustes, y el total no depende de él.
 */
function computeTotals(lines: readonly CartLineView[], shippingCents: number | null): CartTotals {
  const buyable = lines.filter((line) => line.available);
  const subtotalCents = buyable.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
  const totalCents = subtotalCents + (shippingCents ?? 0);
  const taxRateBps = DEFAULT_COMMERCE_SETTINGS.taxRateBps;
  const netCents = Math.round((totalCents * 10_000) / (10_000 + taxRateBps));

  return {
    itemCount: buyable.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    shippingCents,
    taxCents: totalCents - netCents,
    totalCents,
  };
}

export { buildCartView, computeTotals };
export type { CartLineView, CartTotals };
