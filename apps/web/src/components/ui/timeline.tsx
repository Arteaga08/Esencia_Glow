import { formatDateTime } from "@/lib/format-date";

interface TimelineItem {
  id: string;
  title: string;
  /** ISO 8601 — `Timeline` formatea con `formatDateTime` para que toda
   * bitácora del panel se vea igual. */
  at: string;
  description?: string;
  meta?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}

interface TimelineProps {
  items: TimelineItem[];
  emptyMessage: string;
}

/** Mismos 4 pares fondo/texto nombrados en DESIGN.md que usa `Badge`
 * (neutral/positivo/atención/negativo), aplicados al punto del riel. */
const TONE_DOT_CLASSNAMES: Record<NonNullable<TimelineItem["tone"]>, string> = {
  neutral: "bg-muted-foreground-strong",
  warning: "bg-accent-foreground-strong",
  danger: "bg-destructive-action",
  success: "bg-secondary-foreground",
};

/**
 * Riel + puntos, sin sombras (Regla de lo que Flota, DESIGN.md). Genérico y
 * tonto a propósito: no sabe de pedidos, bitácoras ni rastreo — Suscripciones
 * e Inventario lo van a reusar tal cual.
 */
function Timeline({ items, emptyMessage }: TimelineProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-body-sm text-muted-foreground-strong">{emptyMessage}</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id} className="relative border-l border-border pb-1 pl-6 last:border-transparent last:pb-0">
          <span
            aria-hidden="true"
            className={`absolute left-[-3.5px] top-1 size-1.75 rounded-full ${TONE_DOT_CLASSNAMES[item.tone ?? "neutral"]}`}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-body text-foreground">{item.title}</p>
            <span className="font-mono text-body-sm tabular-nums text-muted-foreground">
              {formatDateTime(item.at)}
            </span>
          </div>
          {item.description ? <p className="mt-0.5 text-body-sm text-muted-foreground-strong">{item.description}</p> : null}
          {item.meta ? <p className="mt-0.5 text-body-sm text-muted-foreground">{item.meta}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export type { TimelineItem, TimelineProps };
export { Timeline };
