import { ProductCardSkeleton } from "./product-card-skeleton";
import { SkeletonBlock } from "./skeleton-block";

/** Tarjetas de la rejilla: dos filas de cuatro en escritorio, cuatro filas de dos en móvil. */
const CARD_COUNT = 8;

/**
 * Silueta de los listados del catálogo sin slug (Kits, Más vendidos y Ofertas):
 * placa rosa del encabezado, barra de filtros y rejilla de tarjetas, con las
 * mismas cajas que `CatalogHeading` y `CatalogGrid` para que al llegar los
 * datos nada se mueva. Las rutas con slug (categoría, marca, producto, kit) no
 * llevan `loading.tsx` a propósito: con él, un slug inexistente respondería 200
 * en vez de 404.
 */
function CatalogPageSkeleton() {
  return (
    <main aria-busy="true" aria-label="Cargando productos" className="pt-16 xl:pt-20">
      <section className="bg-blush">
        <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
          <SkeletonBlock tone="blush" className="h-4 w-40" />
          <SkeletonBlock tone="blush" className="mt-4 h-10 w-64 md:h-14 md:w-96" />
          <SkeletonBlock tone="blush" className="mt-3 h-5 w-full max-w-xl" />
        </div>
      </section>
      <div className="mx-auto max-w-shell px-4 py-10 pb-20 md:px-8 xl:px-12">
        <SkeletonBlock className="mb-8 h-10 w-full max-w-md" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
          {Array.from({ length: CARD_COUNT }, (_, position) => (
            <li key={position}>
              <ProductCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export { CatalogPageSkeleton };
