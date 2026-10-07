import { SpotlightCarousel } from "./spotlight-carousel";
import { SpotlightCover } from "./spotlight-cover";
import { SpotlightGrid } from "./spotlight-grid";
import { SpotlightHeader } from "./spotlight-header";
import type { SpotlightProps } from "./spotlight-types";

/**
 * Bloque 5 del home (Novedades / Kits): dentro del contenedor, con esquinas suaves; la portada tiene el
 * mismo alto que la rejilla 2×2 (fotos cuadradas). Título y subtítulo arriba,
 * centrados. Con `tone="blush"` lleva banda rosa para separarse del vecino.
 */
function SpotlightSection({ title, subtitle, href, items, cover, coverSide, tone = "plain" }: SpotlightProps) {
  const coverFirst = coverSide === "left";

  return (
    <section aria-label={title} className={`py-14 md:py-20 ${tone === "blush" ? "bg-blush" : ""}`}>
      <SpotlightHeader title={title} subtitle={subtitle} href={href} tone={tone} />
      <div className="mx-auto max-w-shell px-4 md:px-8 xl:px-12">
        <div className="hidden items-stretch gap-6 lg:grid lg:grid-cols-2">
          <SpotlightCover cover={cover} className={`min-h-[28rem] rounded-md ${coverFirst ? "" : "order-2"}`} />
          <div className={coverFirst ? "" : "order-1"}>
            <SpotlightGrid items={items} gapClassName="gap-x-6 gap-y-8" />
          </div>
        </div>

        <div className="relative lg:hidden">
          <SpotlightCover cover={cover} className="aspect-[3/4] rounded-md" />
          <div className="relative -mx-4 -mt-[32dvh]">
            <SpotlightCarousel items={items} label={title} />
          </div>
        </div>
      </div>
    </section>
  );
}

export { SpotlightSection };
