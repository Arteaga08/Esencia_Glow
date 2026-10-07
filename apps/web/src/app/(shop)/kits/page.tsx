import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CatalogBrowser } from "@/components/storefront/catalog/catalog-browser";
import { KIT_COPY } from "@/components/storefront/catalog/catalog-copy";
import { CatalogHeading } from "@/components/storefront/catalog/catalog-heading";
import { ErrorState } from "@/components/ui/error-state";
import { catalogFiltersToQuery, parseCatalogFilters, parsePage, type RawSearchParams } from "@/lib/storefront/catalog-filters";
import { getKitFacets, getKitsPage } from "@/lib/storefront/kit";

const PATHNAME = "/kits";

export const metadata: Metadata = {
  title: "Kits | Esencia Glow",
  description: "Rutinas completas de Esencia Glow en un solo kit, a un mejor precio.",
};

interface KitsPageProps {
  searchParams: Promise<RawSearchParams>;
}

/**
 * Listado de kits con la misma rejilla del catálogo. Solo filtra por precio y
 * ordena (un kit no tiene marca); el estado vive en la URL, igual que en la
 * categoría.
 */
export default async function KitsPage({ searchParams }: KitsPageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseCatalogFilters(rawSearchParams);
  const page = parsePage(rawSearchParams);

  const [catalogPage, facets] = await Promise.all([getKitsPage(filters, page), getKitFacets()]);

  // Una página más allá de la última (filtros que dejaron menos resultados): volver a la primera.
  if (catalogPage && catalogPage.meta.pages > 0 && page > catalogPage.meta.pages) {
    const query = catalogFiltersToQuery(filters);
    redirect(query ? `${PATHNAME}?${query}` : PATHNAME);
  }

  return (
    <main className="pt-16 xl:pt-20">
      <CatalogHeading title="Kits" description="Rutinas completas en un solo paquete, con un precio pensado para el conjunto." />
      {catalogPage ? (
        <CatalogBrowser pathname={PATHNAME} filters={filters} facets={facets} items={catalogPage.items} meta={catalogPage.meta} copy={KIT_COPY} />
      ) : (
        <div className="mx-auto max-w-shell px-4 py-10 pb-20 md:px-8 xl:px-12">
          <ErrorState title="No pudimos cargar los kits" description="Intenta de nuevo en unos minutos." />
        </div>
      )}
    </main>
  );
}
