/** Meses que cubre cada periodo prepagado. */
const PREPAID_MONTHS = { quarter: 3, year: 12 } as const;

type PrepaidPeriod = keyof typeof PREPAID_MONTHS;

interface PrepaidComparison {
  /** Lo que costaría el mismo periodo pagado mes a mes, en centavos. */
  fullMonthlyCents: number;
  /** Precio prepagado repartido entre sus meses, en centavos (redondeado). */
  monthlyEquivalentCents: number;
  /** Porcentaje de ahorro frente a pagar mes a mes; negativo si el prepagado
   * sale MÁS caro (el caso que el panel tiene que advertir). */
  savingsPercent: number;
}

/**
 * Referencia visual para el operador al fijar un precio prepagado (decisión
 * de Manuel en 2.7b-2, ampliada al trimestral en 3.1.7b): nada de esto se
 * envía a la API ni lo valida el backend, que acepta cualquier entero >= 0.
 * Existe para que un precio prepagado más caro que sus mensualidades no se
 * cree por un error de dedo, ya que después el precio es inmutable.
 */
function comparePrepaidToMonthly(
  priceCents: number,
  prepaidCents: number,
  period: PrepaidPeriod,
): PrepaidComparison | null {
  if (priceCents <= 0 || prepaidCents <= 0) return null;
  const months = PREPAID_MONTHS[period];
  const fullMonthlyCents = priceCents * months;
  return {
    fullMonthlyCents,
    monthlyEquivalentCents: Math.round(prepaidCents / months),
    savingsPercent: ((fullMonthlyCents - prepaidCents) / fullMonthlyCents) * 100,
  };
}

/** "16.7 %" con un decimal, sin decimal si es entero ("20 %"). */
function formatPercent(value: number): string {
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} %`;
}

export { comparePrepaidToMonthly, formatPercent, PREPAID_MONTHS };
export type { PrepaidComparison, PrepaidPeriod };
