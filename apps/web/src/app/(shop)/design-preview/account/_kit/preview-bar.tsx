import Link from "next/link";
import { FOCUS } from "./styles";
import { previewHref, type PreviewState } from "./preview-state";
import { ACCOUNT_VIEWS, AUTH_VIEWS, VIEW_LABELS, VIEW_STATES, type PreviewView } from "./types";

interface PreviewBarProps {
  /** Ruta de la propuesta, p. ej. `/design-preview/account/a`. */
  base: string;
  label: string;
  current: PreviewState;
}

const PILL = `inline-flex min-h-9 shrink-0 items-center rounded-md px-3 font-mono text-label uppercase transition-colors duration-[var(--duration-fast)] ${FOCUS}`;
const ROW = "flex items-center gap-1 overflow-x-auto";
const ROW_LABEL = "w-16 shrink-0 px-2 font-mono text-label uppercase text-muted-foreground-strong";

/**
 * Barra fija al pie, solo de la vista previa: salta entre pantallas y estados
 * de la propuesta (los botones de la propia página también navegan). Se borra
 * con las propuestas.
 */
function PreviewBar({ base, label, current }: PreviewBarProps) {
  const states = VIEW_STATES[current.view];

  function viewPill(view: PreviewView) {
    const active = current.view === view;
    return (
      <Link
        key={view}
        href={previewHref(base, view)}
        aria-current={active && !current.state ? "page" : undefined}
        className={`${PILL} ${active ? "bg-primary text-foreground" : "text-muted-foreground-strong hover:bg-muted"}`}
      >
        {VIEW_LABELS[view]}
      </Link>
    );
  }

  return (
    <nav aria-label={`Vista previa ${label}`} className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-[min(100%-1.5rem,64rem)] flex-col gap-1 rounded-md border border-border-strong bg-surface p-1.5 shadow-overlay">
      <div className={ROW}>
        <span className={ROW_LABEL}>{label} Acceso</span>
        {AUTH_VIEWS.map(viewPill)}
      </div>
      <div className={`${ROW} border-t border-border pt-1`}>
        <span className={ROW_LABEL}>{label} Cuenta</span>
        {ACCOUNT_VIEWS.map(viewPill)}
      </div>
      {states.length > 0 ? (
        <div className={`${ROW} border-t border-border pt-1`}>
          <span className={ROW_LABEL}>Estados</span>
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
