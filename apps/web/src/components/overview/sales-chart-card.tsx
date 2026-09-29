"use client";

import { useState } from "react";
import { OverviewRange } from "@esencia-glow/shared";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesSeries } from "./use-sales-series";
import { SalesSeriesChart } from "./sales-series-chart";
import { RangeFilter } from "./range-filter";
import { formatBucketLabel } from "./format-bucket-label";
import { STATUS_COLORS, type ChartColor } from "./chart-colors";

interface SalesChartCardProps {
  title: string;
  description: string;
  valueKey: "storeRevenueCents" | "subscriptionRevenueCents" | "orderCount";
  color: ChartColor;
  formatValue: (value: number) => string;
}

/** Una gráfica de serie, completa: filtro propio, total del periodo y su
 * comparación contra el periodo anterior. Cada métrica de venta monta la
 * suya — nunca comparten filtro (decisión de Manuel: "deben tener sus
 * gráficas separadas, no todo junto"). */
function SalesChartCard({ title, description, valueKey, color, formatValue }: SalesChartCardProps) {
  const [range, setRange] = useState<OverviewRange>(OverviewRange.WEEK);
  const { series, isRefreshing, loadError, retry } = useSalesSeries(range);

  const total = series?.totals[valueKey] ?? 0;
  const previousTotal = series?.previousTotals[valueKey] ?? 0;
  const deltaPct = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading-sm text-foreground">{title}</h2>
          <p className="text-body-sm text-muted-foreground-strong">{description}</p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      {loadError ? (
        <ErrorState description={loadError} onRetry={retry} />
      ) : !series ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div aria-busy={isRefreshing} className={isRefreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-mono text-heading-md font-semibold" style={{ color: color.base }}>
              {formatValue(total)}
            </span>
            {deltaPct !== null ? (
              <span
                className="text-body-sm font-medium"
                style={{ color: deltaPct >= 0 ? STATUS_COLORS.good : STATUS_COLORS.critical }}
              >
                {deltaPct >= 0 ? "↑" : "↓"} {Math.abs(deltaPct)}% vs. periodo anterior
              </span>
            ) : null}
          </div>
          <SalesSeriesChart
            buckets={series.buckets}
            valueKey={valueKey}
            color={color}
            formatValue={formatValue}
            formatBucketLabel={(iso) => formatBucketLabel(range, iso)}
          />
        </div>
      )}
    </Card>
  );
}

export { SalesChartCard };
