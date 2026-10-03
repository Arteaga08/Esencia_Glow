import { getImageProps } from "next/image";
import Link from "next/link";
import type { PublicHomeOfferBanner } from "@esencia-glow/shared";
import { OfferMarquee } from "./offer-marquee";

const CTA_BUTTON =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-foreground bg-surface px-7 py-3 " +
  "type-shop-cta text-foreground hover:bg-blush " +
  "transition-colors duration-[var(--duration-base)] ease-out-quart " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Banner de oferta: foto a todo lo ancho (vertical de móvil por defecto,
 * horizontal de escritorio desde `md`, igual que el hero), la frase corriendo
 * en bucle sobre la parte baja y el botón abajo a la izquierda. Un velo oscuro
 * al pie asienta la frase blanca sobre cualquier foto.
 */
function OfferBannerSection({ banner }: { banner: PublicHomeOfferBanner }) {
  const { desktop, mobile = desktop } = banner.images;
  const common = { alt: "", fill: true, sizes: "100vw" } as const;
  const { props: desktopProps } = getImageProps({ ...common, src: desktop.url });
  const { props: mobileProps } = getImageProps({ ...common, src: mobile.url });

  return (
    <section aria-labelledby="offer-banner-title" className="relative h-[32rem] overflow-hidden bg-blush md:h-[38rem]">
      <picture>
        <source media="(min-width: 768px)" srcSet={desktopProps.srcSet} sizes="100vw" />
        <img {...mobileProps} alt="" draggable={false} className="object-cover" />
      </picture>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/45 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 pb-10 md:pb-14">
        <h2 id="offer-banner-title" className="sr-only">
          {banner.text}
        </h2>
        <OfferMarquee text={banner.text} className="text-white" />
        <div className="mx-auto mt-6 max-w-shell px-4 md:mt-8 md:px-8 xl:px-12">
          <Link href={banner.ctaHref} className={CTA_BUTTON}>
            {banner.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export { OfferBannerSection };
