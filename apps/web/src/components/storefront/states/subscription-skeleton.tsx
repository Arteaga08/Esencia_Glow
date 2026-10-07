import { SkeletonBlock, sweepStep } from "./skeleton-block";

const PERIODS = [0, 1, 2];
const HIGHLIGHTS = ["w-4/5", "w-3/5", "w-2/3"];

/**
 * Bloque 7. La foto de la caja ocupa el bloque (`h-[26rem]` en móvil,
 * `min-h-[36rem]` en escritorio) y el panel de compra se encima: se pinta
 * sólido para que se lea como el panel real, con sus tres periodos, el precio,
 * las viñetas y el botón.
 */
function SubscriptionSkeleton() {
  return (
    <section aria-hidden="true" style={sweepStep(5)} className="py-14 md:py-20">
      <div className="mx-auto max-w-shell px-4 md:px-8 xl:px-12">
        <div className="relative overflow-hidden rounded-md lg:flex lg:min-h-[36rem] lg:items-center">
          <SkeletonBlock className="h-[26rem] w-full rounded-none lg:absolute lg:inset-0 lg:h-auto" />
          <div className="relative mx-3 -mt-20 min-h-[35.5rem] rounded-md border border-border-strong bg-surface p-6 lg:m-10 lg:ml-auto lg:w-full lg:max-w-md lg:p-8">
            <SkeletonBlock className="h-6 w-44" />
            <div className="mt-5 grid grid-cols-3 gap-2">
              {PERIODS.map((period) => (
                <SkeletonBlock key={period} className="h-14" />
              ))}
            </div>
            <SkeletonBlock className="mt-8 h-14 w-52" />
            <SkeletonBlock className="mt-3 h-4 w-64 max-w-full" />
            <div className="mt-6 space-y-3 border-t border-border-strong pt-6">
              {HIGHLIGHTS.map((width) => (
                <SkeletonBlock key={width} className={`h-4 ${width}`} />
              ))}
            </div>
            <SkeletonBlock className="mt-6 h-12 w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

export { SubscriptionSkeleton };
