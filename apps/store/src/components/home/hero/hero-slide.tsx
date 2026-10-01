import { getImageProps } from "next/image";
import Link from "next/link";
import type { PublicHomeHeroSlide } from "@esencia-glow/shared";

/**
 * Un slide del hero: toda la superficie es el enlace (como Etude, sin botón).
 * Arte dirigido con `<picture>`: la foto vertical de móvil por defecto y la
 * horizontal de escritorio desde `md` (si no subieron la de móvil, la de
 * escritorio sirve para ambos). El texto va en tinta (`text-foreground`); en
 * móvil, un degradado del rosa principal lo asienta sobre la foto.
 */
function HeroSlide({ slide, priority }: { slide: PublicHomeHeroSlide; priority: boolean }) {
  const { desktop, mobile = desktop } = slide.images;
  const common = { alt: "", fill: true, sizes: "100vw", priority } as const;
  const { props: desktopProps } = getImageProps({ ...common, src: desktop.url });
  const { props: mobileProps } = getImageProps({ ...common, src: mobile.url });

  return (
    <Link
      href={slide.ctaHref ?? "/"}
      className="absolute inset-0 block focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={desktopProps.srcSet} sizes="100vw" />
        <img {...mobileProps} alt="" draggable={false} className="object-cover" />
      </picture>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-primary via-primary/60 to-transparent md:hidden"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-shell px-4 pb-20 md:px-8 md:pb-24 xl:px-12">
        <h2 className="text-display max-w-2xl text-foreground">{slide.title}</h2>
        {slide.subtitle ? <p className="mt-2 max-w-xl text-foreground">{slide.subtitle}</p> : null}
      </div>
    </Link>
  );
}

export { HeroSlide };
