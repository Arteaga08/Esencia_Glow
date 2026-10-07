import type { AdminOrder } from "@esencia-glow/shared";

/**
 * Une el pedido que coincide por número (exacto) con los que coinciden por
 * texto (comprador, nombre, teléfono). El de número va primero y no se repite.
 */
function mergeOrders(byNumber: AdminOrder[], byText: AdminOrder[], limit: number): AdminOrder[] {
  const seen = new Set<string>();
  const merged: AdminOrder[] = [];
  for (const order of [...byNumber, ...byText]) {
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    merged.push(order);
  }
  return merged.slice(0, limit);
}

export { mergeOrders };
