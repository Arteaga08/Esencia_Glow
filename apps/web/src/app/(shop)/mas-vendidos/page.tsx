import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CatalogBrowser } from "@/components/storefront/catalog/catalog-browser";
import { BESTSELLER_COPY } from "@/components/storefront/catalog/catalog-copy";
import { CatalogHeading } from "@/components/storefront/catalog/catalog-heading";
import { ErrorState } from "@/components/ui/error-state";
import { catalogFiltersToQuery, parseCatalogFilters, parsePage, type RawSearchParams } from "@/lib/storefront/catalog-filters";
import { getCatalogFacets, getCatalogPage } from "@/lib/storefront/catalog";

const PATHNAME = "/mas-vendidos";
const SCOPE = { bestseller: true } as const;

export const metadata: Metadata = {
  title: "Más vendidos | Esencia Glow",
  description: "Los productos favoritos de nuestras clientas.",
};

interface BestsellersPageProps {
  searchParams: Promise<RawSearchParams>;
}

/**
 * Los productos marcados como "Más vendido", con los mismos filtros de marca
 * y precio, orden y paginación del catálogo por categoría.
 */
export default async function BestsellersPage({ searchParams }: BestsellersPageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseCatalogFilters(rawSearchParams);
  const page = parsePage(rawSearchParams);

  const [catalogPage, facets] = await Promise.all([getCatalogPage(SCOPE, filters, page), getCatalogFacets(SCOPE)]);

  // Una página más allá de la última (filtros que dejaron menos resultados): volver a la primera.
  if (catalogPage && catalogPage.meta.pages > 0 && page > catalogPage.meta.pages) {
    const query = catalogFiltersToQuery(filters);
    redirect(query ? `${PATHNAME}?${query}` : PATHNAME);
  }

  return (
    <main className="pt-16 xl:pt-20">
      <CatalogHeading title="Más vendidos" description="Los productos que más eligen nuestras clientas." />
      {catalogPage ? (
        <CatalogBrowser pathname={PATHNAME} filters={filters} facets={facets} items={catalogPage.items} meta={catalogPage.meta} copy={BESTSELLER_COPY} />
      ) : (
        <div className="mx-auto max-w-shell px-4 py-10 pb-20 md:px-8 xl:px-12">
          <ErrorState title="No pudimos cargar los productos" description="Intenta de nuevo en unos minutos." />
        </div>
      )}
    </main>
  );
}
