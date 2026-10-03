"use client";

import type { ShowcaseCategory } from "@/lib/storefront/category-showcase";
import { SnapCarousel } from "../carousel/snap-carousel";
import { CategoryCardA as CategoryCard } from "./category-card-a";

const TITLE_ID = "category-section-title";

/**
 * Bloque 4 del home: banda rosa a todo lo ancho, fotos cuadradas pegadas entre sí
 * (4 por fila en escritorio) y el mismo carrusel del estante. Las flechas se
 * centran sobre la foto: la mitad de su alto (50 % del ancho de la tarjeta)
 * en `cqw` según el ancho de la tarjeta (72 % / 42 % / 25 %).
 */
function CategorySection({ categories }: { categories: ShowcaseCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby={TITLE_ID} className="bg-blush pt-12 pb-4 md:pt-16 md:pb-6">
      <h2 id={TITLE_ID} className="mb-8 px-4 text-center type-shop-section text-foreground md:mb-10">
        Compra por categoría
      </h2>
      <SnapCarousel
        items={categories}
        getKey={(category) => category.id}
        renderItem={(category, position) => <CategoryCard category={category} priority={position < 4} />}
        label="Categorías"
        itemClassName="basis-[72%] sm:basis-[42%] lg:basis-1/4"
        arrowTopClassName="top-[36cqw] sm:top-[21cqw] lg:top-[12.5cqw]"
        gapClassName="gap-0"
        barClassName="mx-4 mt-2 md:mx-8 xl:mx-12"
      />
    </section>
  );
}

export { CategorySection };
