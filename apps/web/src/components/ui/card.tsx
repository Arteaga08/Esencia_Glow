import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Superficie base (DESIGN.md §5): toda superficie declara `--surface-bg`
 * propio — de eso depende, por ejemplo, la muesca del `<label>` de Input
 * cuando vive dentro de una Card (necesita tapar el borde con el fondo real
 * de su ancestro, no con el del body). Sin sombra en reposo (Regla de lo que
 * Flota): el borde es lo que separa la superficie, nunca una elevación.
 */
function Card({ children, className = "", style, ...props }: CardProps) {
  return (
    <div
      {...props}
      style={{ ...style, "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
      className={
        "rounded-lg border border-border bg-surface p-6 text-foreground " + className
      }
    >
      {children}
    </div>
  );
}

export type { CardProps };
export { Card };
