"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ProductViewImage } from "@/lib/storefront/product-view";
import { MAIN_IMAGE_SIZES } from "./product-styles";

/**
 * Galería de móvil: las fotos en una tira con `scroll-snap` (el dedo la
 * recorre sin JavaScript) y puntos que dicen en cuál va. El punto activo sale
 * de la posición del scroll, redondeada al ancho de una foto.
 */
function GallerySwipe({ images, className = "" }: { images: ProductViewImage[]; className?: string }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);

  function handleScroll() {
    const el = scroller.current;
    if (el && el.clientWidth > 0) setCurrent(Math.round(el.scrollLeft / el.clientWidth));
  }

  if (images.length === 0) return <div aria-hidden="true" className={`aspect-[4/5] rounded-md bg-muted ${className}`} />;

  return (
    <div role="group" aria-roledescription="carrusel" aria-label="Fotos del producto" className={className}>
      <ul
        ref={scroller}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, index) => (
          <li key={image.url} className="relative aspect-[4/5] w-full shrink-0 snap-start bg-muted">
            <Image src={image.url} alt={image.alt} fill sizes={MAIN_IMAGE_SIZES} priority={index === 0} className="object-cover" />
          </li>
        ))}
      </ul>
      {images.length > 1 ? (
        <p aria-live="polite" className="mt-3 flex justify-center gap-2">
          <span className="sr-only">{`Foto ${current + 1} de ${images.length}`}</span>
          {images.map((image, index) => (
            <span
              key={image.url}
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-[width,background-color] duration-[var(--duration-base)] ease-out-quart ${
                index === current ? "w-6 bg-primary-action" : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </p>
      ) : null}
    </div>
  );
}

export { GallerySwipe };
