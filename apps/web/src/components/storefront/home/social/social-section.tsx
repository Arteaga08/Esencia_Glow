"use client";

import { SnapCarousel } from "@/components/storefront/home/carousel/snap-carousel";
import { SOCIAL_HASHTAG, SOCIAL_NETWORKS, SOCIAL_PHOTOS } from "@/lib/storefront/social-feed";
import { NetworkLink } from "./network-link";
import { SocialPhoto } from "./social-photo";

/**
 * Bloque 9 del home: cabecera centrada y una tira de fotos 4:5 en el
 * carrusel compartido del home (swipe, flechas y barra de avance ya
 * resueltos). Las redes van como botones debajo. Es cliente solo porque el
 * carrusel recibe una función de render.
 */
function SocialSection() {
  return (
    <section aria-labelledby="social-title" className="py-14 md:py-20">
      <header className="mx-auto mb-10 flex max-w-shell flex-col items-center px-4 text-center md:mb-12">
        <h2 id="social-title" className="type-shop-section text-foreground">
          Esencia Glow en redes
        </h2>
        <p className="mt-3 max-w-[48ch] text-subtitle text-foreground/80">
          Rutinas reales y lanzamientos. Etiquétanos con {SOCIAL_HASHTAG}.
        </p>
      </header>

      <div className="mx-auto max-w-shell px-4 md:px-8 xl:px-12">
        <SnapCarousel
          items={SOCIAL_PHOTOS}
          getKey={(photo) => photo.url}
          label="Fotos de nuestras redes"
          itemClassName="basis-[72%] sm:basis-[38%] lg:basis-[26%] xl:basis-[22%]"
          arrowTopClassName="top-[45cqw] sm:top-[23.75cqw] lg:top-[16.25cqw] xl:top-[13.75cqw]"
          renderItem={(photo) => (
            <SocialPhoto photo={photo} sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 26vw, 72vw" />
          )}
        />
      </div>

      <div className="mx-auto mt-10 flex max-w-shell flex-wrap justify-center gap-3 px-4">
        {SOCIAL_NETWORKS.map((network) => (
          <NetworkLink key={network.key} network={network} />
        ))}
      </div>
    </section>
  );
}

export { SocialSection };
