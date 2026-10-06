import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

type StatusTone = "neutral" | "success" | "warning";

interface StatusPanelProps {
  icon: Icon;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: StatusTone;
  /** `status` para avisos que aparecen solos; `alert` solo si es un fallo. */
  role?: "status" | "alert";
  /** Clases del título: cada propuesta tiene su propia voz tipográfica. */
  headingClass?: string;
}

const TONE: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground",
  success: "bg-secondary text-secondary-foreground",
  warning: "bg-accent text-accent-foreground-strong",
};

/**
 * Cara de las pantallas que no son formulario: revisa tu correo, enlace
 * vencido, listo. Ícono en un cuadrado de 48px, título, una explicación corta
 * y las acciones debajo.
 */
function StatusPanel({ icon: IconComponent, title, children, actions, tone = "neutral", role = "status", headingClass = "text-page-title text-foreground" }: StatusPanelProps) {
  return (
    <div className="flex flex-col items-start gap-5">
      <span className={`flex size-12 items-center justify-center rounded-md ${TONE[tone]}`}>
        <IconComponent size={24} aria-hidden="true" />
      </span>
      <div role={role}>
        <h1 className={headingClass}>{title}</h1>
        <div className="mt-2 max-w-[48ch] text-body text-foreground/80">{children}</div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-x-5 gap-y-1">{actions}</div> : null}
    </div>
  );
}

export { StatusPanel };
