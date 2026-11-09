import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CatalogBrowser } from "@/components/storefront/catalog/catalog-browser";
import { BRAND_COPY } from "@/components/storefront/catalog/catalog-copy";
import { CatalogHeading } from "@/components/storefront/catalog/catalog-heading";
import { ErrorState } from "@/components/ui/error-state";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { getBrandBySlug } from "@/lib/storefront/brands";
import { catalogFiltersToQuery, parseCatalogFilters, parsePage, type RawSearchParams } from "@/lib/storefront/catalog-filters";
import { getCatalogFacets, getCatalogPage } from "@/lib/storefront/catalog";

interface BrandPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params, searchParams }: BrandPageProps): Promise<Metadata> {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: "Marca no encontrada" };
  // Mismo criterio que la categoría: las vistas filtradas o de la página 2 en adelante no se indexan.
  const isFilteredView = catalogFiltersToQuery({ ...parseCatalogFilters(rawSearchParams), brands: [] }) !== "" || parsePage(rawSearchParams) > 1;
  const logo = brand.logo;
  return buildPageMetadata({
    title: `${brand.name} | Esencia Glow`,
    description: `Compra los productos de ${brand.name} en Esencia Glow: skincare y lifestyle elegido con cuidado.`,
    path: `/marca/${brand.slug}`,
    image: logo ? { url: logo.url, width: logo.width, height: logo.height, alt: logo.alt ?? brand.name } : undefined,
    noIndex: isFilteredView,
  });
}

/**
 * Los productos de una marca (destino de los logos de la cinta del home), con
 * los mismos filtros de precio, orden y paginación del catálogo por categoría.
 * El filtro por marca no aplica: la marca ya es el alcance de la página.
 */
export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const filters = { ...parseCatalogFilters(rawSearchParams), brands: [] };
  const page = parsePage(rawSearchParams);
  const scope = { brand: brand.name };
  const pathname = `/marca/${brand.slug}`;

  const [catalogPage, facets] = await Promise.all([getCatalogPage(scope, filters, page), getCatalogFacets(scope)]);

  // Una página más allá de la última (filtros que dejaron menos resultados): volver a la primera.
  if (catalogPage && catalogPage.meta.pages > 0 && page > catalogPage.meta.pages) {
    const query = catalogFiltersToQuery(filters);
    redirect(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <main className="pt-16 xl:pt-20">
      <CatalogHeading title={brand.name} description={`Todo lo que tenemos de ${brand.name}.`} />
      {catalogPage ? (
        <CatalogBrowser
          pathname={pathname}
          filters={filters}
          facets={{ ...facets, brands: [] }}
          items={catalogPage.items}
          meta={catalogPage.meta}
          copy={BRAND_COPY}
        />
      ) : (
        <div className="mx-auto max-w-shell px-4 py-10 pb-20 md:px-8 xl:px-12">
          <ErrorState title="No pudimos cargar los productos" description="Intenta de nuevo en unos minutos." />
        </div>
      )}
    </main>
  );
}
