import { SkeletonBlock, type SkeletonTone } from "./skeleton-block";

interface SectionHeaderSkeletonProps {
  /** Con subtítulo y botón "Ver todo" (Novedades, Kits) o solo título (Categorías). */
  full?: boolean;
  tone?: SkeletonTone;
  className?: string;
}

/** Silueta de la cabecera centrada de una sección: título, subtítulo y botón. */
function SectionHeaderSkeleton({ full = false, tone = "plain", className = "" }: SectionHeaderSkeletonProps) {
  return (
    <div className={`mx-auto flex max-w-shell flex-col items-center px-4 ${className}`}>
      <SkeletonBlock tone={tone} className="h-7 w-56 md:w-72" />
      {full ? (
        <>
          <SkeletonBlock tone={tone} className="mt-3 h-5 w-72 max-w-full" />
          <SkeletonBlock tone={tone} className="mt-6 h-[42px] w-28" />
        </>
      ) : null}
    </div>
  );
}

export { SectionHeaderSkeleton };
