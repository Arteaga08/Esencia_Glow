import { SkeletonBlock, sweepStep } from "./skeleton-block";

/**
 * Bloque 2. Misma caja que el hero real (`min-h-svh`, rosa `blush`) para que el
 * header transparente nunca quede sobre un vacío. Lleva el único aviso de
 * carga para lectores de pantalla: el resto de los skeletons son `aria-hidden`.
 */
function HeroSkeleton() {
  return (
    <section style={sweepStep(0)} className="flex min-h-svh items-end bg-blush px-4 pb-20 md:px-8 md:pb-24 xl:px-12">
      <p role="status" className="sr-only">
        Cargando la página
      </p>
      <div className="mx-auto w-full max-w-shell">
        <SkeletonBlock tone="blush" className="h-12 w-4/5 max-w-3xl md:h-16" />
        <SkeletonBlock tone="blush" className="mt-4 h-5 w-64 max-w-full" />
      </div>
    </section>
  );
}

export { HeroSkeleton };
