import type { ReactNode } from "react";

/**
 * Mismos 6 valores que el enum `BadgeColor` (packages/shared), como unión de
 * string literal en vez del tipo del enum: así un consumidor puede pasar
 * `"success"` a mano (viene de datos, JSON, o del propio DTO donde
 * `Badge.color` ya llega como string) sin tener que importar y referenciar
 * el enum solo para satisfacer TypeScript.
 */
type BadgeColorValue = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: ReactNode;
  /** Default "neutral" para badges de sistema (estado, etc.) que no vienen
   * de la entidad Badge del catálogo. */
  color?: BadgeColorValue;
  className?: string;
}

/**
 * DESIGN.md §5: `rounded.full`, padding 3px/10px, tipografía Etiqueta. Solo
 * hay 4 pares fondo/texto nombrados en el sistema (neutral/positivo/
 * atención/negativo) pero `BadgeColor` tiene 6 valores — "primary" e "info"
 * no tienen un par dedicado en DESIGN.md, así que se resuelven con el rosa
 * de marca y con el mismo tratamiento neutro, respectivamente. Es una
 * decisión de mapeo, no una lectura literal del documento — ajustable al
 * verla renderizada.
 */
const COLOR_CLASSES: Record<BadgeColorValue, string> = {
  neutral: "bg-muted text-muted-foreground-strong",
  primary: "bg-primary text-foreground",
  success: "bg-secondary text-secondary-foreground",
  warning: "bg-accent text-accent-foreground-strong",
  danger: "bg-destructive/40 text-destructive-action",
  info: "bg-muted text-foreground",
};

function Badge({ children, color = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.75 font-mono text-label " +
        "uppercase tracking-[0.06em] " +
        `${COLOR_CLASSES[color]} ${className}`
      }
    >
      {children}
    </span>
  );
}

export type { BadgeProps };
export { Badge };
