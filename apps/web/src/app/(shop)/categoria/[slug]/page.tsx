import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CatalogBanner } from "@/components/storefront/catalog/catalog-banner";
import { CatalogBrowser } from "@/components/storefront/catalog/catalog-browser";
import { CategoryPills } from "@/components/storefront/catalog/category-pills";
import { SuggestedProducts } from "@/components/storefront/catalog/suggested-products";
import { ErrorState } from "@/components/ui/error-state";
import { getCategoryTree } from "@/lib/storefront/categories";
import { catalogFiltersToQuery, parseCatalogFilters, parsePage, type RawSearchParams } from "@/lib/storefront/catalog-filters";
import { findCatalogCategory, getCatalogFacets, getCatalogPage } from "@/lib/storefront/catalog";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const found = findCatalogCategory(await getCategoryTree(), slug);
  if (!found) return { title: "Categoría no encontrada" };
  return {
    title: `${found.category.name} | Esencia Glow`,
    description: found.category.description || `Compra ${found.category.name} en Esencia Glow.`,
  };
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
