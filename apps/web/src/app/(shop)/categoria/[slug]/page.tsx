import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CatalogBanner } from "@/components/storefront/catalog/catalog-banner";
import { CatalogBrowser } from "@/components/storefront/catalog/catalog-browser";
import { CategoryPills } from "@/components/storefront/catalog/category-pills";
import { SuggestedProducts } from "@/components/storefront/catalog/suggested-products";
import { JsonLdScript } from "@/components/seo/json-ld";
import { ErrorState } from "@/components/ui/error-state";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { getCategoryTree } from "@/lib/storefront/categories";
import { catalogFiltersToQuery, parseCatalogFilters, parsePage, type RawSearchParams } from "@/lib/storefront/catalog-filters";
import { findCatalogCategory, getCatalogFacets, getCatalogPage } from "@/lib/storefront/catalog";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const found = findCatalogCategory(await getCategoryTree(), slug);
  if (!found) return { title: "Categoría no encontrada" };
  const image = found.category.image;
  // La canónica es la categoría sin filtros; las vistas filtradas o de la página 2 en adelante no se indexan.
  const isFilteredView = catalogFiltersToQuery(parseCatalogFilters(rawSearchParams)) !== "" || parsePage(rawSearchParams) > 1;
  return buildPageMetadata({
    title: `${found.category.name} | Esencia Glow`,
    description: found.category.description || `Compra ${found.category.name} en Esencia Glow: skincare y lifestyle elegido con cuidado.`,
    path: `/categoria/${slug}`,
    image: image ? { url: image.url, width: image.width, height: image.height, alt: image.alt ?? found.category.name } : undefined,
    noIndex: isFilteredView,
  });
}

/**
 * Catálogo de una categoría: banner con su foto, subcategorías, filtros por
 * marca y precio, orden y paginación. Todo el estado vive en la URL, así que
 * una vista filtrada se puede compartir y el servidor la renderiza completa.
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, rawSearchParams, tree] = await Promise.all([params, searchParams, getCategoryTree()]);
  const found = findCatalogCategory(tree, slug);
  if (!found) notFound();

  const filters = parseCatalogFilters(rawSearchParams);
  const page = parsePage(rawSearchParams);
  const pathname = `/categoria/${slug}`;

  const [catalogPage, facets] = await Promise.all([getCatalogPage({ category: slug }, filters, page), getCatalogFacets({ category: slug })]);

  // Una página más allá de la última (filtros que dejaron menos resultados): volver a la primera.
  if (catalogPage && catalogPage.meta.pages > 0 && page > catalogPage.meta.pages) {
    const query = catalogFiltersToQuery(filters);
    redirect(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <main className="pt-16 xl:pt-20">
      <JsonLdScript
        data={buildBreadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          ...(found.parent ? [{ name: found.parent.name, path: `/categoria/${found.parent.slug}` }] : []),
          { name: found.category.name, path: pathname },
        ])}
      />
      <CatalogBanner found={found} />
      <CategoryPills root={found.root} currentSlug={slug} className="mx-auto max-w-shell px-4 pt-6 md:px-8 xl:px-12" />
      {catalogPage ? (
        <>
          <CatalogBrowser pathname={pathname} filters={filters} facets={facets} items={catalogPage.items} meta={catalogPage.meta} />
          <SuggestedProducts
            categorySlug={slug}
            activeBrands={filters.brands}
            excludeIds={catalogPage.items.map((item) => item.id)}
          />
        </>
      ) : (
        <div className="mx-auto max-w-shell px-4 pb-20 md:px-8 xl:px-12">
          <ErrorState title="No pudimos cargar los productos" description="Intenta de nuevo en unos minutos." />
        </div>
      )}
    </main>
  );
}
