const MONTHS_PER_YEAR = 12;

interface AnnualComparison {
  /** Lo que cuesta el año pagado mes a mes, en centavos. */
  twelveMonthlyCents: number;
  /** Precio anual repartido entre 12, en centavos (redondeado). */
  monthlyEquivalentCents: number;
  /** Porcentaje de ahorro frente a 12 mensualidades; negativo si el anual
   * sale MÁS caro (el caso que el panel tiene que advertir). */
  savingsPercent: number;
}

/**
 * Referencia visual para el operador al fijar el precio anual (decisión de
 * Manuel en 2.7b-2): nada de esto se envía a la API ni lo valida el backend,
 * que acepta cualquier entero >= 0. Existe para que un anual más caro que
 * 12 mensualidades no se cree por un error de dedo, ya que después el precio
 * es inmutable.
 */
function compareAnnualToMonthly(
  priceCents: number,
  annualPriceCents: number,
): AnnualComparison | null {
  if (priceCents <= 0 || annualPriceCents <= 0) return null;
  const twelveMonthlyCents = priceCents * MONTHS_PER_YEAR;
  return {
    twelveMonthlyCents,
    monthlyEquivalentCents: Math.round(annualPriceCents / MONTHS_PER_YEAR),
    savingsPercent: ((twelveMonthlyCents - annualPriceCents) / twelveMonthlyCents) * 100,
  };
}

/** "16.7 %" con un decimal, sin decimal si es entero ("20 %"). */
function formatPercent(value: number): string {
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} %`;
}

export { compareAnnualToMonthly, formatPercent };
export type { AnnualComparison };
