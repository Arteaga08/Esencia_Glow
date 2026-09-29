/**
 * Colores de marca de las gráficas (Milestone 2.9) — paleta validada por la
 * skill `dataviz` (`node scripts/validate_palette.js`), nunca los tokens
 * pastel de `DESIGN.md`: su croma queda por debajo del piso del validador
 * para servir de relleno de marca (ver docstring de `sales-series-chart.tsx`).
 * Cada métrica lleva su tono base + un paso más claro (mezcla con blanco al
 * 55%, mismo criterio que un paso temprano de la rampa secuencial de la
 * skill) para el degradado vertical de la barra — la lee más "llena" que un
 * relleno plano, sin tocar el tono validado en la base ni en el hover.
 */

interface ChartColor {
  base: string;
  light: string;
}

const CHART_COLORS = {
  store: { base: "#2a78d6", light: "#9fc2ed" },
  subscriptions: { base: "#1baf7a", light: "#98dbc3" },
  orders: { base: "#eb6834", light: "#f6bba4" },
} satisfies Record<string, ChartColor>;

/** Semáforo de estado — reservado, nunca se reusa como "serie 4" (skill
 * `dataviz`). Siempre acompañado de etiqueta + valor visibles, nunca solo
 * el color (ver `status-breakdown-bars.tsx`). */
const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  neutral: "#2a78d6",
} as const;

export { CHART_COLORS, STATUS_COLORS };
export type { ChartColor };
