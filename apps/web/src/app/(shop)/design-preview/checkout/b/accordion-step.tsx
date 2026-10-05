import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/ssr";

type StepStatus = "done" | "active" | "upcoming";

interface AccordionStepProps {
  number: number;
  title: string;
  status: StepStatus;
  /** Resumen de una línea cuando el paso ya está hecho (con su "Cambiar"). */
  summary?: ReactNode;
  /** Formulario del paso, solo cuando está activo. */
  children?: ReactNode;
}

const MARKER: Record<StepStatus, string> = {
  done: "border-secondary bg-secondary text-secondary-foreground",
  active: "border-primary-action bg-primary text-foreground",
  upcoming: "border-border-strong text-muted-foreground-strong",
};

/**
 * Paso del acordeón: solo el activo está abierto. El terminado se cierra a un
 * resumen con "Cambiar" y el que falta es solo su título, así la pantalla
 * muestra una cosa a la vez sin esconder lo ya decidido. El panel es blanco
 * (`--surface-bg`) para que la etiqueta de los campos tape bien el borde.
 */
function AccordionStep({ number, title, status, summary, children }: AccordionStepProps) {
  return (
    <section
      aria-labelledby={`step-${number}`}
      className={`rounded-md border [--surface-bg:var(--color-surface)] ${status === "upcoming" ? "border-border bg-transparent" : "border-border-strong bg-surface"}`}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-data ${MARKER[status]}`}>
          {status === "done" ? <Check size={16} weight="bold" aria-label="Paso completo" /> : number}
        </span>
        <h2 id={`step-${number}`} className={`text-section-title ${status === "upcoming" ? "text-muted-foreground-strong" : "text-foreground"}`}>
          {title}
        </h2>
      </div>
      {status === "done" && summary ? <div className="px-5 pb-5 sm:pl-16">{summary}</div> : null}
      {status === "active" ? <div className="border-t border-border px-5 py-6 sm:pl-16">{children}</div> : null}
    </section>
  );
}

export { AccordionStep };
export type { StepStatus };
