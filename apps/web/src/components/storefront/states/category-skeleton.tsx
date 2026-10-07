import { SectionHeaderSkeleton } from "./section-header-skeleton";
import { SkeletonBlock, sweepStep } from "./skeleton-block";

const ITEMS = [0, 1, 2, 3, 4];

/**
 * Bloque 4. Banda rosa con fotos cuadradas pegadas entre sí (`gap-0`) y, bajo
 * cada una, nombre, dos líneas de descripción y botón, como `CategoryCardA`.
 */
function CategorySkeleton() {
  return (
    <section aria-hidden="true" style={sweepStep(2)} className="bg-blush pt-12 pb-4 md:pt-16 md:pb-6">
      <SectionHeaderSkeleton tone="blush" className="mb-8 md:mb-10" />
      <ul className="flex overflow-hidden">
        {ITEMS.map((item) => (
          <li key={item} className="shrink-0 basis-[72%] sm:basis-[42%] lg:basis-1/4">
            <SkeletonBlock tone="blush" className="aspect-square w-full rounded-none" />
            <div className="flex flex-col items-center px-6 pt-5">
              <SkeletonBlock tone="blush" className="h-6 w-40" />
              <SkeletonBlock tone="blush" className="mt-3 h-4 w-52 max-w-full" />
              <SkeletonBlock tone="blush" className="mt-5 mb-3 h-[42px] w-28" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { CategorySkeleton };
