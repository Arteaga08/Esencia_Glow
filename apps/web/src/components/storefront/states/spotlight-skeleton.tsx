import { ProductCardSkeleton } from "./product-card-skeleton";
import { SectionHeaderSkeleton } from "./section-header-skeleton";
import { SkeletonBlock, sweepStep, type SkeletonTone } from "./skeleton-block";

interface SpotlightSkeletonProps {
  /** Posición del bloque en el barrido. */
  step: number;
  coverSide: "left" | "right";
  tone?: SkeletonTone;
}

const CARDS = [0, 1, 2, 3];

/**
 * Bloque 5 (Novedades o Kits). Escritorio: portada y rejilla 2×2 de fotos
 * cuadradas del mismo alto (`min-h-[28rem]`). Móvil: solo la portada 3:4, que
 * es lo que ocupa el espacio antes de que lleguen las tarjetas.
 */
function SpotlightSkeleton({ step, coverSide, tone = "plain" }: SpotlightSkeletonProps) {
  const coverFirst = coverSide === "left";

  return (
    <section
      aria-hidden="true"
      style={sweepStep(step)}
      className={`py-14 md:py-20 ${tone === "blush" ? "bg-blush" : ""}`}
    >
      <SectionHeaderSkeleton full tone={tone} className="mb-10 md:mb-12" />
      <div className="mx-auto max-w-shell px-4 md:px-8 xl:px-12">
        <div className="hidden items-stretch gap-6 lg:grid lg:grid-cols-2">
          <SkeletonBlock tone={tone} className={`min-h-[28rem] ${coverFirst ? "" : "order-2"}`} />
          <ul className={`grid grid-cols-2 gap-x-6 gap-y-8 ${coverFirst ? "" : "order-1"}`}>
            {CARDS.map((card) => (
              <li key={card}>
                <ProductCardSkeleton compact />
              </li>
            ))}
          </ul>
        </div>
        <SkeletonBlock tone={tone} className="aspect-[3/4] w-full lg:hidden" />
        {/* Lo que sobresale del carrusel de tarjetas, que en móvil se encima a la portada. */}
        <div className="h-24 lg:hidden" />
      </div>
    </section>
  );
}

/** Los dos bloques que pinta `SpotlightBlock` (Novedades y Kits), con la portada en lados opuestos. */
function SpotlightPairSkeleton() {
  return (
    <>
      <SpotlightSkeleton step={3} coverSide="right" />
      <SpotlightSkeleton step={4} coverSide="left" tone="blush" />
    </>
  );
}

export { SpotlightPairSkeleton, SpotlightSkeleton };
