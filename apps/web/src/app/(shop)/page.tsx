import { Suspense } from "react";
import { BrandMarqueeBlock } from "../../components/storefront/home/brands/brand-marquee-block";
import { CategoryBlock } from "../../components/storefront/home/categories/category-block";
import { HeroSection } from "../../components/storefront/home/hero/hero-section";
import { OfferBannerBlock } from "../../components/storefront/home/offer/offer-banner-block";
import { ShelfBlock } from "../../components/storefront/home/shelf/shelf-block";
import { SocialSection } from "../../components/storefront/home/social/social-section";
import { SubscriptionBlock } from "../../components/storefront/home/subscription/subscription-block";
import { SpotlightBlock } from "../../components/storefront/home/spotlight/spotlight-block";
import { CategorySkeleton } from "../../components/storefront/states/category-skeleton";
import { HeroSkeleton } from "../../components/storefront/states/hero-skeleton";
import { OfferSkeleton } from "../../components/storefront/states/offer-skeleton";
import { ShelfSkeleton } from "../../components/storefront/states/shelf-skeleton";
import { SpotlightPairSkeleton } from "../../components/storefront/states/spotlight-skeleton";
import { SubscriptionSkeleton } from "../../components/storefront/states/subscription-skeleton";

// Cada bloque que pide datos lleva su propio <Suspense>: los que ya cargaron se
// pintan sin esperar a los demás, y el skeleton ocupa la misma caja que el
// bloque real. Las redes (bloque 9) son estáticas y no necesitan skeleton, y la
// cinta de marcas no lleva fallback: sin marcas no se pinta y no debe dejar hueco.
// Los siguientes bloques del home (3.1.6 en adelante) se montan debajo del estante.
export default function HomePage() {
  return (
    <main>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>
      <Suspense fallback={null}>
        <BrandMarqueeBlock />
      </Suspense>
      <Suspense fallback={<ShelfSkeleton />}>
        <ShelfBlock />
      </Suspense>
      <Suspense fallback={<CategorySkeleton />}>
        <CategoryBlock />
      </Suspense>
      <Suspense fallback={<SpotlightPairSkeleton />}>
        <SpotlightBlock />
      </Suspense>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <SubscriptionBlock />
      </Suspense>
      <Suspense fallback={<OfferSkeleton />}>
        <OfferBannerBlock />
      </Suspense>
      <SocialSection />
    </main>
  );
}
