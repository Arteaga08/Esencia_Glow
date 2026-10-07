import { SkeletonBlock, sweepStep } from "./skeleton-block";

/**
 * Bloque 8. Misma altura que el banner (`h-[32rem]` / `md:h-[38rem]`), con una
 * barra donde correrá la frase y otra donde irá el botón.
 */
function OfferSkeleton() {
  return (
    <section aria-hidden="true" style={sweepStep(6)} className="relative h-[32rem] overflow-hidden bg-blush md:h-[38rem]">
      <div className="absolute inset-x-0 bottom-0 pb-10 md:pb-14">
        <SkeletonBlock tone="blush" className="h-12 w-full rounded-none md:h-16" />
        <div className="mx-auto mt-6 max-w-shell px-4 md:mt-8 md:px-8 xl:px-12">
          <SkeletonBlock tone="blush" className="h-12 w-44" />
        </div>
      </div>
    </section>
  );
}

export { OfferSkeleton };
