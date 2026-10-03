import type { ShelfItem } from "@/lib/storefront/shelf-item";

/** Las dos fotos de portada del bloque: escritorio y móvil (la móvil es opcional en el panel). */
interface SpotlightCoverImages {
  desktop: string;
  mobile: string;
  alt: string;
}

/** Lo que recibe el bloque 5 del home, sea Novedades o Kits. */
interface SpotlightProps {
  title: string;
  subtitle?: string;
  /** Destino de "Ver todo". */
  href: string;
  /** Las cuatro tarjetas. */
  items: ShelfItem[];
  cover: SpotlightCoverImages;
  /** Novedades lleva la portada a la derecha; Kits, a la izquierda. */
  coverSide: "left" | "right";
  /** `blush` pinta la banda rosa de fondo (para separar dos bloques seguidos). */
  tone?: "plain" | "blush";
}

export type { SpotlightCoverImages, SpotlightProps };
