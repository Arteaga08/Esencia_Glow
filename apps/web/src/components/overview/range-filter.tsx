import { OverviewRange } from "@esencia-glow/shared";

/** Un filtro compartido para las 3 gráficas de serie, en una sola fila
 * (skill `dataviz` §interaction: "filtros en una fila arriba de las
 * gráficas"). Día/semana/mes/año — ventana MÓVIL, ver
 * `resolve-overview-window.ts` en la API. */

const RANGE_OPTIONS: { value: OverviewRange; label: string }[] = [
  { value: OverviewRange.DAY, label: "Día" },
  { value: OverviewRange.WEEK, label: "Semana" },
  { value: OverviewRange.MONTH, label: "Mes" },
  { value: OverviewRange.YEAR, label: "Año" },
];

interface RangeFilterProps {
  value: OverviewRange;
  onChange: (value: OverviewRange) => void;
}

function RangeFilter({ value, onChange }: RangeFilterProps) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Rango de la serie">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`cursor-pointer rounded-[4px] px-3 py-1 text-body-sm transition-colors ${
            value === option.value
              ? "bg-primary text-foreground"
              : "text-muted-foreground-strong hover:bg-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { RangeFilter };
