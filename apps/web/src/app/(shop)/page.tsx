import { CategoryBlock } from "../../components/storefront/home/categories/category-block";
import { HeroSection } from "../../components/storefront/home/hero/hero-section";
import { OfferBannerBlock } from "../../components/storefront/home/offer/offer-banner-block";
import { ShelfBlock } from "../../components/storefront/home/shelf/shelf-block";
import { SubscriptionBlock } from "../../components/storefront/home/subscription/subscription-block";
import { SpotlightBlock } from "../../components/storefront/home/spotlight/spotlight-block";

// Los siguientes bloques del home (3.1.6 en adelante) se montan debajo del estante.
export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <ShelfBlock />
      <CategoryBlock />
      <SpotlightBlock />
      <SubscriptionBlock />
      <OfferBannerBlock />
    </main>
  );
}
