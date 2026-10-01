import { getHomeContent } from "../../../lib/api/home";
import { HeroCarousel } from "./hero-carousel";
import { HeroSlide } from "./hero-slide";

/**
 * Bloque 2 del home. Sin slides publicados (sección apagada, sin imágenes o
 * API caído) cae al bloque rosa con el nombre de la marca, para que el header
 * transparente nunca quede sobre un vacío.
 */
async function HeroSection() {
  const home = await getHomeContent();
  const slides = home?.hero?.slides ?? [];

  if (slides.length === 0) {
    return (
      <section className="flex min-h-svh items-end bg-blush px-4 pb-16 md:px-8 lg:px-12">
        <h1 className="text-display text-foreground">Esencia Glow</h1>
      </section>
    );
  }

  return (
    <HeroCarousel
      slides={slides.map((slide, position) => ({
        id: slide.id,
        title: slide.title,
        node: <HeroSlide slide={slide} priority={position === 0} />,
      }))}
    />
  );
}

export { HeroSection };
