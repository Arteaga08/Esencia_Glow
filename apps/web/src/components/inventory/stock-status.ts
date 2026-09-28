import { ReservationStatus, StockStatus } from "@esencia-glow/shared";
import type { BadgeColorValue } from "@/components/ui/badge";

/**
 * Semántica de DESIGN.md §Badge: agotado → danger, stock bajo → warning
 * (accent), OK → success, sin registro → neutral. "Sin registro" no es
 * "agotado": la variante no tiene fila de `Inventory` todavía.
 */
const STOCK_STATUS_BADGE: Record<StockStatus, { color: BadgeColorValue; label: string }> = {
  [StockStatus.OUT]: { color: "danger", label: "Agotado" },
  [StockStatus.LOW]: { color: "warning", label: "Stock bajo" },
  [StockStatus.OK]: { color: "success", label: "OK" },
  [StockStatus.UNTRACKED]: { color: "neutral", label: "Sin registro" },
};

/** Plurales para los conteos por estado ("2 agotados", "1 bajo"). */
const STOCK_STATUS_COUNT_LABEL: Record<StockStatus, { singular: string; plural: string }> = {
  [StockStatus.OUT]: { singular: "agotado", plural: "agotados" },
  [StockStatus.LOW]: { singular: "bajo", plural: "bajos" },
  [StockStatus.OK]: { singular: "OK", plural: "OK" },
  [StockStatus.UNTRACKED]: { singular: "sin registro", plural: "sin registro" },
};

const RESERVATION_STATUS_BADGE: Record<ReservationStatus, { color: BadgeColorValue; label: string }> = {
  [ReservationStatus.ACTIVE]: { color: "warning", label: "Activo" },
  [ReservationStatus.COMMITTED]: { color: "success", label: "Comprometido" },
  [ReservationStatus.RELEASED]: { color: "neutral", label: "Liberado" },
};

function formatStatusCount(status: StockStatus, count: number): string {
  const label = STOCK_STATUS_COUNT_LABEL[status];
  return `${count} ${count === 1 ? label.singular : label.plural}`;
}

/** Cuenta que necesita atención (agotados + bajos), para abrir por default
 * solo los grupos con algo que surtir. `untracked` no cuenta: no es falta de
 * stock, es falta de captura. */
function needsRestock(statusCounts: Record<StockStatus, number>): boolean {
  return statusCounts[StockStatus.OUT] + statusCounts[StockStatus.LOW] > 0;
}

export {
  STOCK_STATUS_BADGE,
  STOCK_STATUS_COUNT_LABEL,
  RESERVATION_STATUS_BADGE,
  formatStatusCount,
  needsRestock,
};
