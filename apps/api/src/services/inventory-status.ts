import { StockStatus } from "@esencia-glow/shared";

/**
 * Módulo puro, sin I/O: el umbral efectivo (override del SKU si existe, si no
 * el default global de Settings) se resuelve SIEMPRE en el servidor — ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Umbral efectivo y alerta de stock
 * bajo". El cliente del API nunca decide ese fallback.
 */

const STATUS_SEVERITY: Record<StockStatus, number> = {
  [StockStatus.UNTRACKED]: 0,
  [StockStatus.OK]: 1,
  [StockStatus.LOW]: 2,
  [StockStatus.OUT]: 3,
};

/** `override` en 0 sigue siendo un override explícito — solo `undefined` cae al global. */
function resolveEffectiveThreshold(override: number | undefined, globalThreshold: number): number {
  return override ?? globalThreshold;
}

function resolveStockStatus(available: number, threshold: number): StockStatus {
  if (available <= 0) return StockStatus.OUT;
  if (available <= threshold) return StockStatus.LOW;
  return StockStatus.OK;
}

/** Sin filas (`[]`) el producto no tiene ninguna variante con inventario, así
 * que su estado es `untracked` — no "ok" por vacuidad. */
function worstStatus(statuses: readonly StockStatus[]): StockStatus {
  if (statuses.length === 0) return StockStatus.UNTRACKED;
  // `!`: STATUS_SEVERITY es un Record completo sobre StockStatus — el índice
  // nunca falta, `noUncheckedIndexedAccess` solo no puede probarlo estático.
  return statuses.reduce((worst, current) =>
    STATUS_SEVERITY[current]! > STATUS_SEVERITY[worst]! ? current : worst,
  );
}

export { resolveEffectiveThreshold, resolveStockStatus, worstStatus };
