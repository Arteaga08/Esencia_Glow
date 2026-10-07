"use client";

import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { SnapCarousel } from "../carousel/snap-carousel";
import { ShelfCard } from "../shelf/shelf-card";

/**
 * Carrusel móvil de las cuatro tarjetas. Cada una va en un tile blanco para
 * que su texto se lea aunque el carrusel suba sobre la foto de portada.
 */
function SpotlightCarousel({ items, label }: { items: ShelfItem[]; label: string }) {
  return (
    <div className="lg:hidden">
      <SnapCarousel
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => (
          <div className="h-full rounded-md bg-surface p-2 pb-4">
            <ShelfCard item={item} compact />
          </div>
        )}
        label={label}
        itemClassName="basis-[58%] sm:basis-[34%]"
        arrowTopClassName="top-[29cqw] sm:top-[17cqw]"
        gapClassName="gap-3 px-4"
        barClassName="mx-4 mt-4"
      />
    </div>
  );
}

export { SpotlightCarousel };
