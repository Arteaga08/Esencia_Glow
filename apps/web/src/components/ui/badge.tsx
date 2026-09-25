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

/** Mismo orden en todo picker/listado de la paleta fija. */
const BADGE_COLOR_VALUES: BadgeColorValue[] = [
  "neutral",
  "primary",
  "success",
  "warning",
  "danger",
  "info",
];

/** Nombre en español de cada valor — solo para UI de administración (el
 * badge en sí no muestra el nombre del color, solo el color). */
const BADGE_COLOR_LABELS: Record<BadgeColorValue, string> = {
  neutral: "Neutro",
  primary: "Marca",
  success: "Éxito",
  warning: "Atención",
  danger: "Peligro",
  info: "Información",
};

function Badge({ children, color = "neutral", className = "" }: BadgeProps) {
  return (
    // `max-w-full truncate`: el texto de un Badge de catálogo es libre (hasta
    // 40 caracteres, Milestone 1.4.2) y la pill no tiene ancho propio — sin
    // esto, un texto largo se sale del espacio real donde se sobrepone (ej.
    // la foto del producto). El límite de caracteres vive en el backend; el
    // ancho disponible lo impone quien coloca el Badge (`max-w-[…]` en el
    // contenedor), este componente solo garantiza que, si no cabe, se corta
    // con elipsis en vez de desbordar.
    <span
      title={typeof children === "string" ? children : undefined}
      className={
        "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.75 font-mono " +
        "text-label uppercase tracking-[0.06em] " +
        `${COLOR_CLASSES[color]} ${className}`
      }
    >
      {children}
    </span>
  );
}

export type { BadgeProps, BadgeColorValue };
export { Badge, COLOR_CLASSES, BADGE_COLOR_VALUES, BADGE_COLOR_LABELS };
