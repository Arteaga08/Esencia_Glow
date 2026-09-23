import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: Icon;
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * DESIGN.md §5 Page States, Vacío: ícono 32px en `muted-foreground`, título
 * Subtítulo, una línea de Cuerpo pequeño, y si aplica, un botón SECUNDARIO —
 * nunca primario, un estado vacío no empuja la acción más agresiva.
 */
function EmptyState({ icon: IconComponent, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <IconComponent size={32} weight="regular" className="text-muted-foreground" aria-hidden="true" />
      <p className="text-subtitle text-foreground">{title}</p>
      <p className="max-w-[42ch] text-body-sm text-muted-foreground-strong">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export type { EmptyStateProps };
export { EmptyState };
