import type { CartLineInput } from "@esencia-glow/shared";
import type { CartLineView } from "../cart/cart-view";

/**
 * Las líneas que entienden `POST /shipping/quotes` y `POST /orders`: solo QUÉ y
 * cuánto (nunca un precio; el servidor lo recalcula). Lo agotado no se manda.
 * Cotizar y comprar usan esta misma función para que su huella coincida.
 */
function toOrderLines(lines: readonly CartLineView[]): CartLineInput[] {
  return lines.filter((line) => line.available).map(({ itemType, itemId, quantity }) => ({ itemType, itemId, quantity }));
}

/** Identidad estable de QUÉ y cuánto lleva el carrito: si cambia, lo cotizado ya no sirve. */
function linesKeyOf(lines: readonly CartLineInput[]): string {
  return lines
    .map((line) => `${line.itemType}:${line.itemId}:${line.quantity}`)
    .sort()
    .join("|");
}

export { toOrderLines, linesKeyOf };
