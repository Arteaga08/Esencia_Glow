import type { CartLineInput } from "@esencia-glow/shared";

/**
 * Llave de idempotencia de `POST /orders`. Se guarda ATADA a la huella de lo que
 * se pide (líneas + cotización + tarifa): reintentar exactamente lo mismo (red
 * caída, doble clic, recarga a medio pago) reusa la llave y el API responde con
 * el mismo pedido; si cambia algo, la llave anterior ya no aplica y se genera
 * otra (el API rechaza con 409 una llave vieja con un cuerpo distinto).
 */
const STORAGE_KEY = "esencia-glow:checkout-key:v1";

/** Lo mínimo de `Storage` que se necesita; permite probarlo sin navegador. */
interface KeyStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface OrderRequestShape {
  lines: CartLineInput[];
  quoteId: string;
  rateId: string;
}

function fingerprintOrder({ lines, quoteId, rateId }: OrderRequestShape): string {
  const normalized = lines
    .map((line) => `${line.itemType}:${line.itemId}:${line.quantity}`)
    .sort()
    .join("|");
  return `${quoteId}#${rateId}#${normalized}`;
}

function readStored(storage: KeyStorage): { fingerprint: string; key: string } | null {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const { fingerprint, key } = parsed as Record<string, unknown>;
    return typeof fingerprint === "string" && typeof key === "string" ? { fingerprint, key } : null;
  } catch {
    return null;
  }
}

/** Sin almacenamiento (`null`) funciona igual, solo que no recuerda la llave entre recargas. */
function resolveIdempotencyKey(storage: KeyStorage | null, fingerprint: string, makeId: () => string): string {
  if (!storage) return makeId();

  const stored = readStored(storage);
  if (stored && stored.fingerprint === fingerprint) return stored.key;

  const key = makeId();
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint, key }));
  } catch {
    // Almacenamiento lleno o bloqueado: solo se pierde recordar la llave.
  }
  return key;
}

/** Al crearse el pedido la llave ya cumplió: no debe sobrevivir a una compra nueva. */
function forgetIdempotencyKey(storage: KeyStorage | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Ver `resolveIdempotencyKey`.
  }
}

/** `sessionStorage` si el navegador lo deja usar (modo privado estricto puede bloquearlo). */
function browserKeyStorage(): KeyStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export { fingerprintOrder, resolveIdempotencyKey, forgetIdempotencyKey, browserKeyStorage };
export type { KeyStorage, OrderRequestShape };
