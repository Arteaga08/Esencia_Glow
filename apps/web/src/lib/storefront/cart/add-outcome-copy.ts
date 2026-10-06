import { MAX_ORDER_LINES } from "@esencia-glow/shared";
import { maxQuantityFor, type AddOutcome, type CartItemType } from "./cart-store";

/**
 * Aviso en lenguaje humano cuando agregar topó un límite; `null` si no hay
 * nada que avisar. Va pegado al control que la clienta tocó.
 */
function describeAddOutcome(outcome: AddOutcome, itemType: CartItemType): string | null {
  if (outcome === "capped") return `Ya tienes el máximo de ${maxQuantityFor(itemType)} en tu carrito.`;
  if (outcome === "full") {
    return `Tu carrito llegó al límite de ${MAX_ORDER_LINES} productos distintos. Quita alguno para agregar otro.`;
  }
  return null;
}

export { describeAddOutcome };
