import { HeroSection } from "../../components/home/hero/hero-section";

// Los siguientes bloques del home (3.1.3 en adelante) se montan debajo del hero.
export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <section className="min-h-svh px-4 py-16 md:px-8 lg:px-12" />
    </main>
  );
}
