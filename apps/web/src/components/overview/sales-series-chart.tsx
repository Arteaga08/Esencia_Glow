"use client";

import { useState } from "react";
import type { SalesBucket } from "./use-sales-series";
import type { ChartColor } from "./chart-colors";

/**
 * Barras de una sola serie (skill `dataviz`, form: magnitud a lo largo del
 * tiempo). Un solo tono validado (nunca los tokens pastel de DESIGN.md como
 * relleno de marca — su croma queda por debajo del piso del validador,
 * `node scripts/validate_palette.js`; DESIGN.md sigue dando el fondo, la
 * cuadrícula y el texto). Degradado vertical claro→base (ver
 * `chart-colors.ts`) para que la barra se lea llena, no plana. Sin leyenda:
 * una sola serie, el título ya la nombra. Extremo redondeado 4px anclado a
 * la base, separación de 2px entre barras, tooltip por barra con el valor
 * exacto y la fecha.
 */

const CHART_HEIGHT = 160;

interface SalesSeriesChartProps {
  buckets: SalesBucket[];
  /** `storeRevenueCents` | `subscriptionRevenueCents` | `orderCount`. */
  valueKey: "storeRevenueCents" | "subscriptionRevenueCents" | "orderCount";
  color: ChartColor;
  formatValue: (value: number) => string;
  formatBucketLabel: (iso: string) => string;
}

function SalesSeriesChart({ buckets, valueKey, color, formatValue, formatBucketLabel }: SalesSeriesChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const values = buckets.map((bucket) => bucket[valueKey]);
  const max = Math.max(1, ...values);

  if (buckets.length === 0) {
    return <p className="text-body-sm text-muted-foreground-strong">Sin datos en este rango.</p>;
  }

  return (
    <div className="relative">
      <div
        className="flex items-end gap-0.5"
        style={{ height: CHART_HEIGHT }}
        role="img"
        aria-label={`Serie de ${buckets.length} periodos, valor máximo ${formatValue(max)}`}
      >
        {buckets.map((bucket, index) => {
          const value = bucket[valueKey];
          const heightPx = value === 0 ? 2 : Math.max(3, Math.round((value / max) * (CHART_HEIGHT - 8)));
          const isHovered = hoverIndex === index;
          return (
            <button
              key={bucket.start}
              type="button"
              className="group relative flex-1 cursor-pointer bg-transparent p-0"
              style={{ height: CHART_HEIGHT }}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
              onFocus={() => setHoverIndex(index)}
              onBlur={() => setHoverIndex((current) => (current === index ? null : current))}
            >
              <span
                className="absolute bottom-0 left-0 block w-full rounded-t-[4px] transition-[opacity,filter]"
                style={{
                  height: heightPx,
                  background: `linear-gradient(180deg, ${color.light} 0%, ${color.base} 100%)`,
                  opacity: isHovered || hoverIndex === null ? 1 : 0.55,
                  filter: isHovered ? "brightness(1.08) saturate(1.15)" : "none",
                  boxShadow: isHovered ? `0 0 0 1px ${color.base}` : "none",
                }}
              />
              {isHovered ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-label text-foreground shadow-md"
                >
                  <span className="block font-mono font-semibold" style={{ color: color.base }}>
                    {formatValue(value)}
                  </span>
                  <span className="block text-muted-foreground-strong">{formatBucketLabel(bucket.start)}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-label text-muted-foreground-strong">
        <span>{formatBucketLabel(buckets[0]!.start)}</span>
        <span>{formatBucketLabel(buckets[buckets.length - 1]!.start)}</span>
      </div>
    </div>
  );
}

export { SalesSeriesChart };
