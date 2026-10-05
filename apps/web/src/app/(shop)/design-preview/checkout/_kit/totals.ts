import type { PreviewLine } from "./preview-types";

// Mismo IVA por defecto del backend (`DEFAULT_COMMERCE_SETTINGS.taxRateBps`).
const TAX_RATE_BPS = 1600;

interface PreviewTotals {
  itemCount: number;
  subtotalCents: number;
  /** `null` mientras la clienta no ha elegido una tarifa de envío. */
  shippingCents: number | null;
  /** Desglose del IVA ya incluido en el total, nunca un cargo extra. */
  taxCents: number;
  totalCents: number;
}

/**
 * Misma aritmética que `order-totals.ts` del API: los precios ya traen el IVA,
 * así que se desglosa del total (neto redondeado, impuesto por resta).
 * Las líneas agotadas no suman: no se pueden comprar.
 */
function computeTotals(lines: PreviewLine[], shippingCents: number | null): PreviewTotals {
  const buyable = lines.filter((line) => line.available);
  const subtotalCents = buyable.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
  const totalCents = subtotalCents + (shippingCents ?? 0);
  const netCents = Math.round((totalCents * 10_000) / (10_000 + TAX_RATE_BPS));

  return {
    itemCount: buyable.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    shippingCents,
    taxCents: totalCents - netCents,
    totalCents,
  };
}

export { computeTotals };
export type { PreviewTotals };
