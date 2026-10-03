import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { ShelfCard } from "../shelf/shelf-card";

interface SpotlightGridProps {
  items: ShelfItem[];
  /** Separación entre tarjetas (cadena literal para que Tailwind la detecte). */
  gapClassName?: string;
}

/** Rejilla 2×2 de escritorio (desde `lg`); debajo de ese ancho se usa `SpotlightCarousel`. */
function SpotlightGrid({ items, gapClassName = "gap-x-6 gap-y-10" }: SpotlightGridProps) {
  return (
    <ul className={`hidden grid-cols-2 lg:grid ${gapClassName}`}>
      {items.map((item) => (
        <li key={item.id}>
          <ShelfCard item={item} compact />
        </li>
      ))}
    </ul>
  );
}

export { SpotlightGrid };
