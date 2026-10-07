import type { PublicOrder } from "@esencia-glow/shared";
import type { CartRowLine } from "@/components/storefront/cart/cart-line-row";
import type { CartTotals } from "../cart/cart-view";

/**
 * Un pedido ya creado, en la forma que pinta el resumen del checkout y la
 * confirmación. Los totales son los del pedido (lo que se cobra de verdad), no
 * los del carrito: el servidor los recalculó al crearlo.
 */
function summarizeOrder(order: PublicOrder): { lines: CartRowLine[]; totals: CartTotals } {
  const lines: CartRowLine[] = order.lines.map((line) => ({
    kind: line.itemType === "bundle" ? "kit" : "product",
    name: line.name,
    variantLabel: line.variantName ?? "",
    priceCents: line.unitPriceCents,
    quantity: line.quantity,
    ...(line.image ? { image: { url: line.image.url, alt: line.image.alt ?? line.name } } : {}),
    available: true,
  }));

  return {
    lines,
    totals: {
      itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalCents: order.totals.subtotalCents,
      shippingCents: order.totals.shippingCents,
      taxCents: order.totals.taxCents,
      totalCents: order.totals.totalCents,
      ...(order.totals.discountCents > 0 ? { discountCents: order.totals.discountCents } : {}),
      ...(order.coupon ? { couponCode: order.coupon.code } : {}),
    },
  };
}

export { summarizeOrder };
