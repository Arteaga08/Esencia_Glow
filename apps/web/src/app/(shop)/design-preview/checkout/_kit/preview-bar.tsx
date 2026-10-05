import Link from "next/link";
import { FOCUS } from "./cta-styles";
import { previewHref, type PreviewState } from "./preview-state";
import { PREVIEW_VIEWS, VIEW_LABELS, VIEW_STATES } from "./preview-types";

interface PreviewBarProps {
  /** Ruta de la propuesta, p. ej. `/design-preview/checkout/a`. */
  base: string;
  label: string;
  current: PreviewState;
}

const PILL = `inline-flex min-h-9 shrink-0 items-center rounded-md px-3 font-mono text-label uppercase transition-colors duration-[var(--duration-fast)] ${FOCUS}`;

/**
 * Barra fija al pie, solo de la vista previa: salta entre vistas y estados de
 * la propuesta (los botones de la propia página también navegan). Se borra con
 * las propuestas.
 */
function PreviewBar({ base, label, current }: PreviewBarProps) {
  const states = VIEW_STATES[current.view];

  return (
    <nav
      aria-label={`Vista previa ${label}`}
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-fit flex-col gap-1 rounded-md border border-border-strong bg-surface p-1.5 shadow-overlay"
    >
      <div className="flex items-center gap-1 overflow-x-auto">
        <span className="shrink-0 px-2 font-mono text-label uppercase text-muted-foreground-strong">{label}</span>
        {PREVIEW_VIEWS.map((view) => (
          <Link
            key={view}
            href={previewHref(base, view)}
            aria-current={current.view === view && !current.state ? "page" : undefined}
            className={`${PILL} ${current.view === view ? "bg-primary text-foreground" : "text-muted-foreground-strong hover:bg-muted"}`}
          >
            {VIEW_LABELS[view]}
          </Link>
        ))}
      </div>
      {states.length > 0 ? (
        <div className="flex items-center gap-1 overflow-x-auto border-t border-border pt-1">
          <span className="shrink-0 px-2 font-mono text-label uppercase text-muted-foreground-strong">Estados</span>
          {states.map((state) => (
            <Link
              key={state.key}
              href={previewHref(base, current.view, state.key)}
              aria-current={current.state === state.key ? "page" : undefined}
              className={`${PILL} ${current.state === state.key ? "bg-primary text-foreground" : "text-muted-foreground-strong hover:bg-muted"}`}
            >
              {state.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}

export { PreviewBar };
