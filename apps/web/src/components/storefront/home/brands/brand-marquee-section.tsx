import Image from "next/image";
import Link from "next/link";
import type { PublicBrand } from "@esencia-glow/shared";
import { Marquee } from "../../layout/marquee";

const LINK_CLASS =
  "block cursor-pointer px-8 py-2 md:px-14 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground";

/**
 * Cinta de marcas bajo el hero: el rosa de la marca con cada logo en tinta
 * (`brightness-0`), para que cualquier logo que suba la clienta, del color que
 * sea, se lea igual sobre el rosa (7.57:1). Cada marca lleva a su página; sin
 * logo se muestra el nombre. Corre despacio y se detiene al pasar el cursor o
 * enfocar un enlace.
 */
function BrandMarqueeSection({ brands }: { brands: PublicBrand[] }) {
  return (
    <section aria-labelledby="brand-marquee-title" className="bg-primary">
      <h2 id="brand-marquee-title" className="sr-only">
        Marcas
      </h2>
      <Marquee seconds={Math.max(40, brands.length * 5)} className="py-7 md:py-9">
        {brands.map((brand) => (
          <Link key={brand.id} href={`/marca/${brand.slug}`} className={LINK_CLASS}>
            {brand.logo ? (
              <Image
                src={brand.logo.url}
                alt={brand.name}
                width={brand.logo.width}
                height={brand.logo.height}
                sizes="160px"
                draggable={false}
                className="h-7 w-auto max-w-40 object-contain brightness-0 transition-opacity duration-[var(--duration-base)] ease-out-quart hover:opacity-70 md:h-8"
              />
            ) : (
              <span className="type-shop-card-title whitespace-nowrap text-foreground">{brand.name}</span>
            )}
          </Link>
        ))}
      </Marquee>
    </section>
  );
}

export { BrandMarqueeSection };
