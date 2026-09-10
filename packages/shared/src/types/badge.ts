import type { BadgeColor } from "../enums/badge-color.js";

/**
 * DTO público de la badge de un producto: se resuelve dentro de
 * `PublicProduct` (catalog-dto.ts) para que el storefront la pinte en
 * tarjeta y PDP sin un fetch aparte.
 */
interface PublicBadge {
  text: string;
  color: BadgeColor;
}

export type { PublicBadge };
