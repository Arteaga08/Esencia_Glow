"use client";

import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { SnapCarousel } from "../carousel/snap-carousel";
import { ShelfCard } from "./shelf-card";

/**
 * Carrusel del estante: el carrusel genérico con la tarjeta de producto.
 * Flechas centradas sobre la foto (4:5): la mitad de su alto = 62.5 % del
 * ancho de la tarjeta, que vale 72 % / 42 % / 22.5 % del carrusel según el
 * breakpoint (ver `itemClassName`). `cqw` = ancho del contenedor.
 */
function ShelfCarousel({ items }: { items: ShelfItem[] }) {
  return (
    <SnapCarousel
      items={items}
      getKey={(item) => item.id}
      renderItem={(item, position) => <ShelfCard item={item} priority={position < 4} />}
      label="Productos"
      itemClassName="basis-[72%] sm:basis-[42%] lg:basis-[22.5%]"
      arrowTopClassName="top-[45cqw] sm:top-[26.25cqw] lg:top-[14.0625cqw]"
    />
  );
}

export { ShelfCarousel };
