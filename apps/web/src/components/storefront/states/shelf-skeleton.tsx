import { ProductCardSkeleton } from "./product-card-skeleton";
import { SkeletonBlock, sweepStep } from "./skeleton-block";

const ITEMS = [0, 1, 2, 3, 4];

/**
 * Bloque 3. Mismo contenedor, mismas pestañas y mismos anchos por breakpoint
 * que `ShelfSection` + `ShelfCarousel` (72 % / 42 % / 22.5 %); el sobrante se
 * recorta igual que en el carrusel real y se reserva el lugar de su barra de avance.
 */
function ShelfSkeleton() {
  return (
    <section aria-hidden="true" style={sweepStep(1)} className="mx-auto max-w-shell px-4 py-16 md:px-8 md:py-24 xl:px-12">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-8">
          <SkeletonBlock className="h-7 w-44" />
          <SkeletonBlock className="h-7 w-14" />
        </div>
        <SkeletonBlock className="h-[42px] w-24" />
      </div>
      <ul className="flex gap-4 overflow-hidden">
        {ITEMS.map((item) => (
          <li key={item} className="shrink-0 basis-[72%] sm:basis-[42%] lg:basis-[22.5%]">
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
      {/* Lugar de la barra de avance del carrusel real (invisible hasta el primer scroll). */}
      <div className="mt-10 h-0.5" />
    </section>
  );
}

export { ShelfSkeleton };
