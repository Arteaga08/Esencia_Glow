import { SkeletonBlock, sweepStep } from "./skeleton-block";

/**
 * Bloque de asesoría. Misma caja que el real: el arco de la foto a la
 * izquierda y, a la derecha, las líneas del título, el texto y el botón.
 */
function AdviceSkeleton() {
  return (
    <section aria-hidden="true" style={sweepStep(6)} className="grid md:grid-cols-[5fr_6fr]">
      <div className="flex items-center justify-center bg-blush px-6 py-12 md:min-h-[42rem]">
        {/* El recorte va en el contenedor: `.sk` trae su propio radio y le ganaría a `rounded-t-full`. */}
        <div className="aspect-[3/4] w-[62%] max-w-sm overflow-hidden rounded-t-full xl:max-w-md">
          <SkeletonBlock tone="blush" className="size-full" />
        </div>
      </div>
      <div className="flex items-center bg-muted px-4 py-14 md:px-12 lg:px-24">
        <div className="w-full max-w-xl">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="mt-5 h-12 w-full max-w-md" />
          <SkeletonBlock className="mt-3 h-12 w-2/3 max-w-xs" />
          <SkeletonBlock className="mt-6 h-5 w-full max-w-md" />
          <SkeletonBlock className="mt-2 h-5 w-3/4 max-w-sm" />
          <SkeletonBlock className="mt-8 h-12 w-48" />
        </div>
      </div>
    </section>
  );
}

export { AdviceSkeleton };
