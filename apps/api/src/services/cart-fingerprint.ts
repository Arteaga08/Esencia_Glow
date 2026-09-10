import { createHash } from "node:crypto";

/**
 * Huella determinista del carrito, para verificar que no cambió entre
 * cotizar el envío y confirmar la orden (ver shipping-quote.service.ts). Un
 * mismatch al crear la orden rechaza con 409 en vez de re-cotizar en
 * silencio.
 *
 * Solo identidad (`itemType` + `itemId`) y cantidad — nunca precios: el
 * envío depende de peso/dimensiones, no de precio, y los totales de la
 * orden se recalculan siempre desde la DB, así que un cambio de precio se
 * recoge solo sin invalidar la cotización de envío.
 *
 * Versionado (`"v1|"`) para poder cambiar la normalización en el futuro sin
 * que una huella vieja compare falsamente igual a una nueva.
 */

interface CartLineForFingerprint {
  itemType: "product" | "bundle";
  itemId: string;
  quantity: number;
}

function normalizeCartLines(
  lines: readonly CartLineForFingerprint[],
): CartLineForFingerprint[] {
  const merged = new Map<string, CartLineForFingerprint>();
  for (const line of lines) {
    const key = `${line.itemType}:${line.itemId}`;
    const existing = merged.get(key);
    merged.set(key, {
      itemType: line.itemType,
      itemId: line.itemId,
      quantity: (existing?.quantity ?? 0) + line.quantity,
    });
  }
  return [...merged.values()].sort((a, b) => {
    const key = (l: CartLineForFingerprint) => `${l.itemType}:${l.itemId}`;
    return key(a).localeCompare(key(b));
  });
}

function computeCartFingerprint(lines: readonly CartLineForFingerprint[]): string {
  const normalized = normalizeCartLines(lines);
  const canonical = `v1|${JSON.stringify(normalized)}`;
  return createHash("sha256").update(canonical).digest("hex");
}

export { computeCartFingerprint, normalizeCartLines };
export type { CartLineForFingerprint };
