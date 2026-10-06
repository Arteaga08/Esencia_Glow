import { MAX_BUNDLE_QUANTITY, MAX_ORDER_LINES } from "@esencia-glow/shared";

/**
 * Carrito de la tienda: funciones PURAS sobre un arreglo inmutable. No toca
 * `localStorage` ni React (eso vive en `use-cart.ts`), así se prueba sin
 * navegador. Guarda solo QUÉ lleva la clienta (`itemType`, `itemId`,
 * `quantity`) más un snapshot mínimo para pintar al instante; el precio y la
 * disponibilidad vivos los resuelve `POST /cart/resolve`.
 *
 * `itemId` es el `variantId` de un producto o el `bundleId` de un kit, igual
 * que en las líneas que entiende la API de órdenes.
 */

type CartItemType = "product" | "bundle";

interface CartSnapshot {
  name: string;
  brand?: string;
  /** Presentación ("30 ml") o "N productos" en un kit. */
  variantLabel: string;
  priceCents: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  image?: { url: string; alt?: string };
  slug?: string;
}

interface CartItemInput {
  itemType: CartItemType;
  itemId: string;
  snapshot: CartSnapshot;
}

interface CartLine extends CartItemInput {
  quantity: number;
}

type Cart = readonly CartLine[];

/** `added`: entró todo; `capped`: topó el máximo por línea; `full`: ya hay MAX_ORDER_LINES líneas; `ignored`: cantidad inválida. */
type AddOutcome = "added" | "capped" | "full" | "ignored";

interface AddResult {
  cart: Cart;
  outcome: AddOutcome;
}

const STORAGE_KEY = "esencia-glow:cart:v1";
const STORAGE_VERSION = 1;
// Mismo tope del selector de cantidad de la ficha de producto.
const MAX_PRODUCT_QUANTITY = 10;

const EMPTY_CART: Cart = Object.freeze([]);

function lineKey(itemType: CartItemType, itemId: string): string {
  return `${itemType}:${itemId}`;
}

function maxQuantityFor(itemType: CartItemType): number {
  return itemType === "bundle" ? MAX_BUNDLE_QUANTITY : MAX_PRODUCT_QUANTITY;
}

function clampQuantity(itemType: CartItemType, quantity: number): number {
  return Math.min(Math.max(quantity, 1), maxQuantityFor(itemType));
}

function addLine(cart: Cart, input: CartItemInput, quantity = 1): AddResult {
  if (!Number.isInteger(quantity) || quantity < 1) return { cart, outcome: "ignored" };

  const key = lineKey(input.itemType, input.itemId);
  const existing = cart.find((line) => lineKey(line.itemType, line.itemId) === key);
  const max = maxQuantityFor(input.itemType);

  if (!existing) {
    if (cart.length >= MAX_ORDER_LINES) return { cart, outcome: "full" };
    const next = Math.min(quantity, max);
    return {
      cart: [...cart, { ...input, quantity: next }],
      outcome: next < quantity ? "capped" : "added",
    };
  }

  if (existing.quantity >= max) return { cart, outcome: "capped" };
  const next = Math.min(existing.quantity + quantity, max);
  return {
    // Se refresca el snapshot: lo último que vio la clienta es lo más reciente.
    cart: cart.map((line) => (line === existing ? { ...input, quantity: next } : line)),
    outcome: next < existing.quantity + quantity ? "capped" : "added",
  };
}

function setQuantity(cart: Cart, key: string, quantity: number): Cart {
  const target = cart.find((line) => lineKey(line.itemType, line.itemId) === key);
  if (!target) return cart;
  const next = clampQuantity(target.itemType, quantity);
  if (next === target.quantity) return cart;
  return cart.map((line) => (line === target ? { ...line, quantity: next } : line));
}

function removeLine(cart: Cart, key: string): Cart {
  return cart.filter((line) => lineKey(line.itemType, line.itemId) !== key);
}

function countItems(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

function serializeCart(cart: Cart): string {
  return JSON.stringify({ version: STORAGE_VERSION, lines: cart });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSnapshot(value: unknown): CartSnapshot | null {
  if (!isRecord(value)) return null;
  const { name, brand, variantLabel, priceCents, listPriceCents, image, slug } = value;
  if (typeof name !== "string" || typeof variantLabel !== "string") return null;
  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0) return null;

  const snapshot: CartSnapshot = { name, variantLabel, priceCents };
  if (typeof brand === "string") snapshot.brand = brand;
  if (typeof slug === "string") snapshot.slug = slug;
  if (typeof listPriceCents === "number" && Number.isInteger(listPriceCents)) snapshot.listPriceCents = listPriceCents;
  if (isRecord(image) && typeof image.url === "string") {
    snapshot.image = { url: image.url, ...(typeof image.alt === "string" ? { alt: image.alt } : {}) };
  }
  return snapshot;
}

function parseLine(value: unknown): CartLine | null {
  if (!isRecord(value)) return null;
  const { itemType, itemId, quantity } = value;
  if (itemType !== "product" && itemType !== "bundle") return null;
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) return null;
  const snapshot = parseSnapshot(value.snapshot);
  if (!snapshot) return null;
  return { itemType, itemId, quantity: clampQuantity(itemType, quantity), snapshot };
}

/**
 * Lee lo guardado con tolerancia total: lo roto, de otra versión o manipulado
 * a mano nunca rompe la tienda, solo se descarta (línea por línea) y, si no
 * queda nada válido, el carrito arranca vacío.
 */
function parseCart(raw: string | null): Cart {
  if (!raw) return EMPTY_CART;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.lines)) return EMPTY_CART;

    const merged = new Map<string, CartLine>();
    for (const candidate of parsed.lines) {
      const line = parseLine(candidate);
      if (!line) continue;
      const key = lineKey(line.itemType, line.itemId);
      const previous = merged.get(key);
      if (previous) {
        merged.set(key, { ...previous, quantity: clampQuantity(line.itemType, previous.quantity + line.quantity) });
      } else if (merged.size < MAX_ORDER_LINES) {
        merged.set(key, line);
      }
    }
    return merged.size > 0 ? [...merged.values()] : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

export {
  STORAGE_KEY,
  EMPTY_CART,
  lineKey,
  maxQuantityFor,
  addLine,
  setQuantity,
  removeLine,
  countItems,
  serializeCart,
  parseCart,
};
export type { Cart, CartLine, CartItemInput, CartItemType, CartSnapshot, AddOutcome, AddResult };
