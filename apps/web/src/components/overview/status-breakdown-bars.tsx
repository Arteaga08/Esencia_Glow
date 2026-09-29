import Link from "next/link";
import { STATUS_COLORS } from "./chart-colors";

/**
 * Reparto por renglón (skill `dataviz`, form: magnitud por categoría, pocas
 * categorías -> barras horizontales, no dona). El valor y la etiqueta van
 * SIEMPRE visibles como texto (nunca solo el color) — así una fila con
 * `tone` de bajo contraste (warning/serious, ver `references/palette.md`)
 * no depende del color para leerse. Colores de estado de la paleta validada
 * por dataviz (`chart-colors.ts`), reservados: nunca se reusan como
 * "serie 4". El valor numérico se pinta del mismo tono que su barra — así
 * la fila se lee de un vistazo, no solo por el largo de la barra.
 */

type BreakdownTone = "neutral" | "good" | "warning" | "critical";

interface BreakdownRow {
  key: string;
  label: string;
  value: number;
  href: string;
  tone?: BreakdownTone;
}

interface StatusBreakdownBarsProps {
  rows: BreakdownRow[];
}

function StatusBreakdownBars({ rows }: StatusBreakdownBarsProps) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const widthPct = row.value === 0 ? 0 : Math.max(4, Math.round((row.value / max) * 100));
        const color = STATUS_COLORS[row.tone ?? "neutral"];
        return (
          <Link
            key={row.key}
            href={row.href}
            className="group flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50"
          >
            <span className="w-28 shrink-0 truncate text-body-sm text-foreground">{row.label}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[filter] group-hover:brightness-110"
                style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${color}cc 0%, ${color} 100%)` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-mono text-body-sm font-semibold" style={{ color }}>
              {row.value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export { StatusBreakdownBars };
export type { BreakdownRow, BreakdownTone };
