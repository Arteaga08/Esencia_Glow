/**
 * Paleta fija de colores de badge (enum, no color picker libre): son tokens
 * semánticos, no valores hex, para que el sistema de diseño re-skineable
 * (Milestone 2.0) los mapee a la paleta de marca sin migrar datos.
 */
enum BadgeColor {
  NEUTRAL = "neutral",
  PRIMARY = "primary",
  SUCCESS = "success",
  WARNING = "warning",
  DANGER = "danger",
  INFO = "info",
}

export { BadgeColor };
