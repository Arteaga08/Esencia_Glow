import { ShelfCarousel } from "@/components/storefront/home/shelf/shelf-carousel";
import type { ShelfItem } from "@/lib/storefront/shelf-item";

const TITLE_ID = "suggested-products-title";

/**
 * Mismo formato que el estante "Más vendidos" del home: título a la izquierda
 * y el carrusel de tarjetas con flechas y barra de avance. Una línea arriba lo
 * separa de la rejilla del catálogo. Sin "Ver todo": las sugerencias no tienen
 * una página propia.
 */
function SuggestedSection({ title, items }: { title: string; items: ShelfItem[] }) {
  return (
    <section aria-labelledby={TITLE_ID} className="border-t border-border">
      <div className="mx-auto max-w-shell px-4 py-16 md:px-8 md:py-24 xl:px-12">
        <h2 id={TITLE_ID} className="mb-10 type-shop-section text-foreground">
          {title}
        </h2>
        <ShelfCarousel items={items} />
      </div>
    </section>
  );
}

export { SuggestedSection };
