/**
 * Íconos permitidos para un beneficio del home: enum fijo, no un ícono o SVG
 * libre — mismo criterio que `BadgeColor`: son tokens semánticos que el
 * storefront (Milestone 3) mapea a su set de íconos sin migrar datos.
 * Valores provisionales hasta que se cierre la estructura final del home.
 */
enum HomeBenefitIcon {
  LEAF = "leaf",
  SPARKLES = "sparkles",
  HEART = "heart",
  GIFT = "gift",
  TRUCK = "truck",
  SHIELD = "shield",
}

export { HomeBenefitIcon };
