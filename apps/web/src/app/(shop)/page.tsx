import { HeroSection } from "../../components/storefront/home/hero/hero-section";
import { ShelfBlock } from "../../components/storefront/home/shelf/shelf-block";

// Los siguientes bloques del home (3.1.4 en adelante) se montan debajo del estante.
export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <ShelfBlock />
    </main>
  );
}
