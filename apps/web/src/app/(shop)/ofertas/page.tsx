import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CatalogBrowser } from "@/components/storefront/catalog/catalog-browser";
import { SALE_COPY } from "@/components/storefront/catalog/catalog-copy";
import { CatalogHeading } from "@/components/storefront/catalog/catalog-heading";
import { ErrorState } from "@/components/ui/error-state";
import { catalogFiltersToQuery, parseCatalogFilters, parsePage, type RawSearchParams } from "@/lib/storefront/catalog-filters";
import { getCatalogFacets, getCatalogPage } from "@/lib/storefront/catalog";
import { getHomeContent } from "@/lib/storefront/home";

const PATHNAME = "/ofertas";
const SCOPE = { onSale: true } as const;

export const metadata: Metadata = {
  title: "Ofertas | Esencia Glow",
  description: "Productos con precio rebajado por tiempo limitado.",
};

interface SalePageProps {
  searchParams: Promise<RawSearchParams>;
}

/**
 * Los productos con precio anterior capturado en el panel (los que muestran
 * dos precios), con los mismos filtros de marca y precio, orden y paginación
 * del catálogo por categoría. La foto del encabezado se carga en el panel
 * (Contenido del home → Banner de oferta); sin ella queda el rosa liso.
 */
export default async function SalePage({ searchParams }: SalePageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseCatalogFilters(rawSearchParams);
  const page = parsePage(rawSearchParams);

  const [catalogPage, facets, homeContent] = await Promise.all([
    getCatalogPage(SCOPE, filters, page),
    getCatalogFacets(SCOPE),
    getHomeContent(),
  ]);

  // Una página más allá de la última (filtros que dejaron menos resultados): volver a la primera.
  if (catalogPage && catalogPage.meta.pages > 0 && page > catalogPage.meta.pages) {
    const query = catalogFiltersToQuery(filters);
    redirect(query ? `${PATHNAME}?${query}` : PATHNAME);
  }

  return (
    <main className="pt-16 xl:pt-20">
      <CatalogHeading title="Ofertas" description="Tus favoritos con precio rebajado." image={homeContent?.salePage?.image} />
      {catalogPage ? (
        <CatalogBrowser pathname={PATHNAME} filters={filters} facets={facets} items={catalogPage.items} meta={catalogPage.meta} copy={SALE_COPY} />
      ) : (
        <div className="mx-auto max-w-shell px-4 py-10 pb-20 md:px-8 xl:px-12">
          <ErrorState title="No pudimos cargar los productos" description="Intenta de nuevo en unos minutos." />
        </div>
      )}
    </main>
  );
}
