"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductViewImage } from "@/lib/storefront/product-view";
import { GallerySwipe } from "./gallery-swipe";
import { FOCUS, MAIN_IMAGE_SIZES } from "./product-styles";

/**
 * Galería de escritorio: miniaturas en columna a la izquierda que cambian la
 * foto principal. Bajo `lg` se reemplaza por la tira deslizable. Con una sola
 * foto no hay miniaturas; sin fotos queda un recuadro vacío del mismo tamaño
 * (no mueve la página).
 */
function ProductGallery({ images }: { images: ProductViewImage[] }) {
  const [selected, setSelected] = useState(0);
  const main = images[selected] ?? images[0];

  return (
    <>
      <GallerySwipe images={images} className="lg:hidden" />
      <div className="hidden gap-4 lg:flex">
        {images.length > 1 ? (
          <ul className="flex w-20 shrink-0 flex-col gap-2">
            {images.map((image, index) => (
              <li key={image.url}>
                <button
                  type="button"
                  aria-label={`Ver foto ${index + 1} de ${images.length}`}
                  aria-current={index === selected}
                  onClick={() => setSelected(index)}
                  className={`relative block aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-md border bg-muted transition-[border-color,opacity] duration-[var(--duration-base)] ease-out-quart ${FOCUS} ${
                    index === selected ? "border-primary-action" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="relative aspect-[4/5] min-w-0 flex-1 overflow-hidden rounded-md bg-muted">
          {main ? <Image key={main.url} src={main.url} alt={main.alt} fill sizes={MAIN_IMAGE_SIZES} priority className="object-cover" /> : null}
        </div>
      </div>
    </>
  );
}

export { ProductGallery };
