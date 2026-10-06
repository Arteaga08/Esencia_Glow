"use client";

import { useSyncExternalStore } from "react";
import {
  EMPTY_CART,
  STORAGE_KEY,
  addLine,
  countItems,
  parseCart,
  removeLine,
  serializeCart,
  setQuantity,
  type AddOutcome,
  type Cart,
  type CartItemInput,
} from "./cart-store";

/**
 * Conexión del carrito puro con el navegador. `localStorage` es un sistema
 * externo de verdad, así que se sincroniza con `useSyncExternalStore` (mismo
 * patrón que `components/shell/sidebar.tsx`): el snapshot de servidor es el
 * carrito vacío, sin salto de hidratación.
 *
 * El evento nativo `storage` solo dispara en OTRAS pestañas; para que la propia
 * pestaña re-renderice se notifica además a los listeners en memoria.
 *
 * Con el almacenamiento bloqueado (modo privado) el carrito sigue funcionando
 * durante la visita desde `memoryCart`; solo no se recuerda al recargar.
 */
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedCart: Cart = EMPTY_CART;
// Solo se usa si `localStorage` no deja escribir; null = manda lo guardado.
let memoryCart: Cart | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCart(): Cart {
  if (memoryCart) return memoryCart;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedCart;
  }
  // `getSnapshot` debe devolver la misma referencia mientras nada cambie.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCart = parseCart(raw);
  }
  return cachedCart;
}

function writeCart(cart: Cart): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeCart(cart));
    memoryCart = null;
  } catch {
    memoryCart = cart;
  }
  listeners.forEach((listener) => listener());
}

function getServerCart(): Cart {
  return EMPTY_CART;
}

/** Resultado de agregar: `changed` dice si el carrito cambió (para decidir si se abre el panel). */
interface AddToCartResult {
  outcome: AddOutcome;
  changed: boolean;
}

function addCartItem(input: CartItemInput, quantity = 1): AddToCartResult {
  const current = readCart();
  const result = addLine(current, input, quantity);
  const changed = result.cart !== current;
  if (changed) writeCart(result.cart);
  return { outcome: result.outcome, changed };
}

function setCartQuantity(key: string, quantity: number): void {
  const current = readCart();
  const next = setQuantity(current, key, quantity);
  if (next !== current) writeCart(next);
}

function removeCartItem(key: string): void {
  writeCart(removeLine(readCart(), key));
}

/** Se llama solo cuando el pedido ya se creó: el carrito cumplió y la compra sigue en el pedido. */
function clearCart(): void {
  writeCart(EMPTY_CART);
}

function subscribeNever(): () => void {
  return () => undefined;
}

interface UseCart {
  lines: Cart;
  count: number;
  /** `false` en el servidor y durante la hidratación: ahí el carrito aún no se conoce, no está vacío. */
  hydrated: boolean;
}

function useCart(): UseCart {
  const lines = useSyncExternalStore(subscribe, readCart, getServerCart);
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  return { lines, count: countItems(lines), hydrated };
}

export { useCart, addCartItem, setCartQuantity, removeCartItem, clearCart };
export type { UseCart, AddToCartResult };
